import { Dialog, DialogContent } from "@/shared/ui/dialog";

type ErrorDialogProps = {
  children: React.ReactNode;
};

export function ErrorDialog({ children }: ErrorDialogProps) {
  return (
    <Dialog defaultOpen>
      <DialogContent className="shadow-dialog-secondary w-2xs p-8 pt-18 text-center text-xl font-semibold">
        {children}
      </DialogContent>
    </Dialog>
  );
}
