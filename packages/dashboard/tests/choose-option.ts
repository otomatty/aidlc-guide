import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

export async function chooseOption(
  label: string | RegExp,
  option: string | RegExp,
): Promise<void> {
  await userEvent.click(screen.getByRole("combobox", { name: label }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}
