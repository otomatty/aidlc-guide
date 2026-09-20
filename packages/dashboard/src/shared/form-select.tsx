import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FormSelectOption = { value: string; label: string };

export function FormSelect({
  id,
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  id?: string;
  value: string;
  options: readonly FormSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const items = options.map((option) => ({
    label: option.label,
    value: option.value === "" ? null : option.value,
  }));
  return (
    <Select
      items={items}
      value={value === "" ? null : value}
      onValueChange={(next) => onChange(typeof next === "string" ? next : "")}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value ?? ""} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
