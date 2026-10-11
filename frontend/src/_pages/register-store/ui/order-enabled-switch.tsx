import { cn } from "@/shared/lib/utils";
import { DotText } from "@/shared/ui/dot-text";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

type OrderEnabledSwitchProps = {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onBlur: () => void;
  onCheckedChange: (checked: boolean) => void;
};

export function OrderEnabledSwitch({
  id,
  checked,
  disabled,
  onBlur,
  onCheckedChange,
}: OrderEnabledSwitchProps) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onBlur={onBlur}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="border-tertiary focus-visible:ring-ring relative flex w-full cursor-pointer flex-row items-center justify-center gap-2 rounded-full border p-2 outline-none select-none"
    >
      <DotText aria-hidden className="pointer-events-none flex-1">
        使用する　
      </DotText>

      <DotText aria-hidden className="pointer-events-none flex-1">
        使用しない
      </DotText>

      <SwitchPrimitive.Thumb
        aria-hidden
        className={cn(
          "bg-tertiary text-primary-foreground pointer-events-none absolute inset-y-1 left-1 flex w-[calc(50%-0.25rem)] items-center justify-center rounded-full",
          "transition-transform duration-100 data-checked:translate-x-0 data-unchecked:translate-x-full",
        )}
      >
        <DotText>{checked ? "使用する" : "使用しない"}</DotText>
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
}
