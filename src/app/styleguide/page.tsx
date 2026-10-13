import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/chip";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ProgressLine } from "@/components/ui/progress-line";
import { CapitalChips, SheetDemo } from "./demos";

export const metadata: Metadata = { title: "UI foundation" };

// Development-only preview of the UI kit. Not available in production.
export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-8">
      <h1 className="text-2xl font-semibold">UI foundation</h1>

      <Card emphasis eyebrow="My Big Goal · Career" title="Complete professional certification">
        <p className="text-ink-muted">Q1 milestone: Modules 1–3</p>
      </Card>

      <Card title="This week's commitments">
        <ul className="flex flex-col gap-5">
          <li className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span>Exercise 3 times</span>
              <Tag>Health</Tag>
            </div>
            <ProgressLine value={3} target={3} minimum={2} tone="achieved" label="3 of 3 sessions, minimum 2" />
            <span className="text-sm text-achieved">Achieved</span>
          </li>
          <li className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span>Save UGX 250,000</span>
              <Tag>Financial</Tag>
            </div>
            <ProgressLine value={200000} target={250000} minimum={200000} tone="within" label="UGX 200,000 of 250,000, minimum 200,000" />
            <span className="text-sm text-within">Within minimum</span>
          </li>
          <li className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span>Do 50 practice questions</span>
              <Tag>Career</Tag>
            </div>
            <ProgressLine value={15} target={50} minimum={30} tone="below" label="15 of 50 questions, minimum 30" />
            <span className="text-sm text-below">Below minimum — what&apos;s the smallest next step?</span>
          </li>
        </ul>
      </Card>

      <Card title="Focus capitals">
        <CapitalChips />
      </Card>

      <Card title="Form fields">
        <div className="flex flex-col gap-4">
          <Field id="sg-vision" label="Your 3-year vision" hint="A sentence or two is enough.">
            <Textarea id="sg-vision" />
          </Field>
          <Field id="sg-amount" label="Amount" error="Please enter a number.">
            <Input id="sg-amount" inputMode="decimal" aria-invalid aria-describedby="sg-amount-error" />
          </Field>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        <Button block>Primary action</Button>
        <Button block variant="secondary">Secondary action</Button>
        <Button block variant="quiet">Quiet action</Button>
        <SheetDemo />
      </div>
    </main>
  );
}
