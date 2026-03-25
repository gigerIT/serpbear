import { normalizeDomainInput } from "../../../utils/client/validators";

describe("normalizeDomainInput", () => {
  it("normalizes bare hostnames and strips the scheme", () => {
    expect(normalizeDomainInput("Example.com")).toBe("example.com");
    expect(normalizeDomainInput("https://Example.com/")).toBe("example.com");
  });

  it("preserves non-root paths while trimming extra slashes", () => {
    expect(normalizeDomainInput("https://example.com/blog/")).toBe(
      "example.com/blog"
    );
  });

  it("rejects invalid or unsupported inputs", () => {
    expect(normalizeDomainInput("")).toBeNull();
    expect(normalizeDomainInput("ftp://example.com")).toBeNull();
    expect(normalizeDomainInput("not a url")).toBeNull();
  });
});
