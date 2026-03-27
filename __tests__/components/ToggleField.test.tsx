import { fireEvent, render, screen } from "@testing-library/react";

import ToggleField from "../../components/common/ToggleField";

describe("ToggleField", () => {
  it("renders the cleaned toggle classes and toggles the value", () => {
    const onChange = jest.fn();
    const { container } = render(
      <ToggleField
        label="Retry failed scrapes"
        value={false}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("checkbox"));

    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByText("Retry failed scrapes")).not.toHaveClass(
      "dark:text-gray-300"
    );

    const toggleTrack = container.querySelector("div.relative.rounded-3xl");
    expect(toggleTrack?.className).not.toContain(
      "dark:peer-focus:ring-blue-800rounded-full"
    );
  });
});
