import type { NextApiRequest, NextApiResponse } from "next";
import Cryptr from "cryptr";
import db from "../../database/database";
import Domain from "../../database/models/domain";
import Keyword from "../../database/models/keyword";
import getdomainStats from "../../utils/domains";
import verifyUser from "../../utils/verifyUser";
import {
  checkSerchConsoleIntegration,
  removeLocalSCData,
} from "../../utils/searchConsole";
import { removeFromRetryQueue } from "../../utils/scraper";
import { normalizeDomainInput } from "../../utils/client/validators";
import {
  buildPersistedScraperSettings,
  maskDomainScraperSettings,
  parseDomainScraperSettings,
} from "../../utils/domainScraperSettings";
import safeJsonParse from "../../utils/safeJsonParse";

const toDomainSlug = (value: string): string =>
  value.replace(/-/g, "_").replace(/\./g, "-").replace(/\//g, "-");

type DomainsGetRes = {
  domains: DomainType[];
  error?: string | null;
};

type DomainsAddResponse = {
  domains: DomainType[] | null;
  error?: string | null;
};

type DomainsDeleteRes = {
  domainRemoved: number;
  keywordsRemoved: number;
  SCDataRemoved: boolean;
  error?: string | null;
};

type DomainsUpdateRes = {
  domain: DomainType | null;
  error?: string | null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  await db.sync();
  const authorized = verifyUser(req, res);
  if (authorized !== "authorized") {
    return res.status(401).json({ error: authorized });
  }
  if (req.method === "GET") {
    return getDomains(req, res);
  }
  if (req.method === "POST") {
    return addDomain(req, res);
  }
  if (req.method === "DELETE") {
    return deleteDomain(req, res);
  }
  if (req.method === "PUT") {
    return updateDomain(req, res);
  }
  return res.status(502).json({ error: "Unrecognized Route." });
}

export const getDomains = async (
  req: NextApiRequest,
  res: NextApiResponse<DomainsGetRes>
) => {
  const withStats = !!req?.query?.withstats;
  try {
    const allDomains: Domain[] = await Domain.findAll();
    const formattedDomains: DomainType[] = allDomains.map((el) => {
      const domainItem: DomainType = el.get({ plain: true });
      const scData = domainItem?.search_console
        ? safeJsonParse<Record<string, string> | null>(
            domainItem.search_console,
            {}
          )
        : {};
      const { client_email, private_key } = scData || {};
      const searchConsoleData = scData
        ? {
            ...scData,
            client_email: client_email ? "true" : "",
            private_key: private_key ? "true" : "",
          }
        : {};
      return {
        ...domainItem,
        search_console: JSON.stringify(searchConsoleData),
        scraper_settings: maskDomainScraperSettings(
          parseDomainScraperSettings(domainItem.scraper_settings)
        ),
      };
    });
    const theDomains: DomainType[] = withStats
      ? await getdomainStats(formattedDomains)
      : formattedDomains;
    return res.status(200).json({ domains: theDomains });
  } catch (error) {
    return res
      .status(400)
      .json({ domains: [], error: "Error Getting Domains." });
  }
};

const addDomain = async (
  req: NextApiRequest,
  res: NextApiResponse<DomainsAddResponse>
) => {
  const { domains } = req.body;
  if (domains && Array.isArray(domains) && domains.length > 0) {
    const uniqueDomains = new Set<string>();
    const domainsToAdd: any[] = [];

    domains.forEach((domain: string) => {
      const normalizedDomain = normalizeDomainInput(domain);
      if (!normalizedDomain || uniqueDomains.has(normalizedDomain)) {
        return;
      }

      uniqueDomains.add(normalizedDomain);
      domainsToAdd.push({
        domain: normalizedDomain,
        slug: toDomainSlug(normalizedDomain),
        lastUpdated: new Date().toJSON(),
        added: new Date().toJSON(),
      });
    });

    if (domainsToAdd.length === 0) {
      return res
        .status(400)
        .json({ domains: [], error: "Necessary data missing." });
    }

    try {
      const newDomains: Domain[] = await Domain.bulkCreate(domainsToAdd);
      const formattedDomains = newDomains.map((el) => el.get({ plain: true }));
      return res.status(201).json({ domains: formattedDomains });
    } catch (error) {
      console.log("[ERROR] Adding New Domain ", error);
      return res
        .status(400)
        .json({ domains: [], error: "Error Adding Domain." });
    }
  } else {
    return res
      .status(400)
      .json({ domains: [], error: "Necessary data missing." });
  }
};

export const deleteDomain = async (
  req: NextApiRequest,
  res: NextApiResponse<DomainsDeleteRes>
) => {
  if (!req.query.domain && typeof req.query.domain !== "string") {
    return res.status(400).json({
      domainRemoved: 0,
      keywordsRemoved: 0,
      SCDataRemoved: false,
      error: "Domain is Required!",
    });
  }
  try {
    const { domain } = req.query || {};
    await Promise.all(
      (
        await Keyword.findAll({ where: { domain } })
      ).map((keyword) => removeFromRetryQueue(keyword.ID))
    );
    const removedDomCount: number = await Domain.destroy({ where: { domain } });
    const removedKeywordCount: number = await Keyword.destroy({
      where: { domain },
    });
    const SCDataRemoved = await removeLocalSCData(domain as string);

    return res.status(200).json({
      domainRemoved: removedDomCount,
      keywordsRemoved: removedKeywordCount,
      SCDataRemoved,
    });
  } catch (error) {
    console.log("[ERROR] Deleting Domain: ", req.query.domain, error);
    return res.status(400).json({
      domainRemoved: 0,
      keywordsRemoved: 0,
      SCDataRemoved: false,
      error: "Error Deleting Domain",
    });
  }
};

export const updateDomain = async (
  req: NextApiRequest,
  res: NextApiResponse<DomainsUpdateRes>
) => {
  if (!req.query.domain) {
    return res.status(400).json({ domain: null, error: "Domain is Required!" });
  }
  const { domain } = req.query || {};
  const {
    notification_interval,
    notification_emails,
    search_console,
    scraper_settings,
    scrape_strategy,
    scrape_pagination_limit,
    scrape_smart_full_fallback,
  } = req.body as DomainSettings;

  try {
    const domainToUpdate: Domain | null = await Domain.findOne({
      where: { domain },
    });
    // Validate Search Console API Data
    if (
      domainToUpdate &&
      search_console?.client_email &&
      search_console?.private_key
    ) {
      const theDomainObj = domainToUpdate.get({ plain: true });
      const isSearchConsoleAPIValid = await checkSerchConsoleIntegration({
        ...theDomainObj,
        search_console: JSON.stringify(search_console),
      });
      if (!isSearchConsoleAPIValid.isValid) {
        return res
          .status(400)
          .json({ domain: null, error: isSearchConsoleAPIValid.error });
      }
      const cryptr = new Cryptr(process.env.SECRET as string);
      search_console.client_email = search_console.client_email
        ? cryptr.encrypt(search_console.client_email.trim())
        : "";
      search_console.private_key = search_console.private_key
        ? cryptr.encrypt(search_console.private_key.trim())
        : "";
    }
    if (
      Object.prototype.hasOwnProperty.call(req.body, "scraper_settings") &&
      !process.env.SECRET
    ) {
      return res.status(500).json({
        domain: null,
        error: "Server configuration error",
      });
    }

    if (domainToUpdate) {
      const existingScraperSettings = parseDomainScraperSettings(
        domainToUpdate.get("scraper_settings")
      );
      let persistedScraperSettings: string | null | undefined;

      if (Object.prototype.hasOwnProperty.call(req.body, "scraper_settings")) {
        const cryptr = new Cryptr(process.env.SECRET as string);
        const nextScraperSettings = buildPersistedScraperSettings(
          scraper_settings ?? null,
          existingScraperSettings,
          cryptr
        );
        persistedScraperSettings = nextScraperSettings
          ? JSON.stringify(nextScraperSettings)
          : null;
      }

      domainToUpdate.set({
        notification_interval,
        notification_emails,
        search_console: JSON.stringify(search_console),
        ...(persistedScraperSettings !== undefined && {
          scraper_settings: persistedScraperSettings,
        }),
        scrape_strategy: scrape_strategy || "",
        scrape_pagination_limit: scrape_pagination_limit || 0,
        scrape_smart_full_fallback: !!scrape_smart_full_fallback,
      });
      await domainToUpdate.save();

      const plainDomain = domainToUpdate.get({ plain: true }) as DomainType;
      const scData = plainDomain?.search_console
        ? safeJsonParse<Record<string, string> | null>(
            plainDomain.search_console,
            {}
          )
        : {};
      const { client_email, private_key } = scData || {};
      const searchConsoleData = scData
        ? {
            ...scData,
            client_email: client_email ? "true" : "",
            private_key: private_key ? "true" : "",
          }
        : {};
      return res.status(200).json({
        domain: {
          ...plainDomain,
          search_console: JSON.stringify(searchConsoleData),
          scraper_settings: maskDomainScraperSettings(
            parseDomainScraperSettings(plainDomain.scraper_settings)
          ),
        },
      });
    }
    return res.status(200).json({ domain: domainToUpdate });
  } catch (error) {
    console.log("[ERROR] Updating Domain: ", req.query.domain, error);
    return res.status(400).json({
      domain: null,
      error: "Error Updating Domain. An Unknown Error Occurred.",
    });
  }
};
