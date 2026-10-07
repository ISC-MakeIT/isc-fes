import { Dialog, DialogContent } from "@/shared/ui/dialog";

type ErrorDialogProps = {
  message: string;
};

export function ErrorDialog({ message }: ErrorDialogProps) {
  return (
    <Dialog>
      <DialogContent className="shadow-dialog-secondary">
        <p>{message}</p>
      </DialogContent>
    </Dialog>
  );
}
