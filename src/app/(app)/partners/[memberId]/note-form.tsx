"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { saveNote, type NoteState } from "../actions";

export function NoteForm({ reflectionId, existing, name }: { reflectionId: string; existing: string; name: string }) {
  const [state, action, pending] = useActionState<NoteState, FormData>(saveNote, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="reflection_id" value={reflectionId} />
      <Field id={`note-${reflectionId}`} label={existing ? "Your note" : `Encourage ${name}`} error={state.error}>
        <Textarea id={`note-${reflectionId}`} name="body" rows={2} maxLength={500} defaultValue={existing} placeholder="Well done on…" />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : existing ? "Update note" : "Send note"}
        </Button>
        {state.ok && (
          <span role="status" className="text-sm text-achieved">
            Sent
          </span>
        )}
      </div>
    </form>
  );
}
