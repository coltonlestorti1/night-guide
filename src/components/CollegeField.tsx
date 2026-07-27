/**
 * College + class year picker — shared by onboarding (/welcome) and Edit
 * profile so the two can't diverge.
 *
 * Both halves are optional and clearable: the field is skippable at onboarding
 * and a user who skipped must be able to add it later. `value` of null means
 * "not answered", which is distinct from any school.
 *
 * The list is local (src/data/colleges.ts), not a Supabase query — onboarding
 * must not wait on a round trip, and the list is static. Deliberately a
 * curated list with no free-text escape: free text fragments "NYU" into four
 * spellings and silently breaks the school-matching this exists to enable.
 * Unlisted schools are captured via onRequestSchool instead.
 */
import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, GraduationCap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { logEvent } from "@/lib/analytics";
import { classYearOptions, getCollege, searchColleges } from "@/data/colleges";

export default function CollegeField({
  collegeSlug,
  classYear,
  onCollegeChange,
  onClassYearChange,
  disabled,
}: {
  collegeSlug: string | null;
  classYear: number | null;
  onCollegeChange: (slug: string | null) => void;
  onClassYearChange: (year: number | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = getCollege(collegeSlug);
  const years = useMemo(() => classYearOptions(), []);
  const results = useMemo(() => searchColleges(query), [query]);

  /**
   * Demand signal for schools we don't carry, so the curated list can grow
   * from evidence instead of guesswork. Read it in Supabase:
   *   select props->>'query', count(*) from events
   *   where event_name = 'college_missing' group by 1 order by 2 desc;
   *
   * Fires only on a deliberate tap, never per keystroke, and the term is
   * capped — analytics props must stay low-cardinality and PII-free, and this
   * is a free-text box someone could type anything into.
   */
  const reportMissingSchool = () => {
    const term = query.trim().slice(0, 60);
    if (term) logEvent("college_missing", { query: term });
    toast.success("Thanks — we'll look at adding it.");
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {/* Clear the query on close so reopening starts from the full list
            (launch campus first) rather than the last search. */}
        <Popover
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setQuery("");
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              role="combobox"
              aria-expanded={open}
              aria-label="School"
              disabled={disabled}
              className="h-11 min-w-0 flex-1 justify-between rounded-xl px-3 font-normal"
            >
              <span className="flex min-w-0 items-center gap-2">
                <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className={cn("truncate", !selected && "text-muted-foreground")}>
                  {selected ? selected.name : "Add your school"}
                </span>
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          {/* Width tracks the trigger so the list never overflows a phone. */}
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            {/* shouldFilter={false}: cmdk's built-in scoring re-sorts and
                re-selects the list, which buried the launch campus at the
                bottom. Filtering here keeps searchColleges' ordering exactly. */}
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search schools…"
                value={query}
                onValueChange={setQuery}
              />
              <CommandList>
                <CommandEmpty className="px-3 py-6 text-center">
                  <p className="text-sm text-muted-foreground">No school by that name.</p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-3 h-9 rounded-lg text-xs"
                    onClick={reportMissingSchool}
                  >
                    My school isn't listed
                  </Button>
                </CommandEmpty>
                <CommandGroup>
                  {results.map((c) => (
                    <CommandItem
                      key={c.slug}
                      value={c.slug}
                      onSelect={() => {
                        onCollegeChange(c.slug === collegeSlug ? null : c.slug);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          c.slug === collegeSlug ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{c.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {c.city}, {c.state}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Clearing the school clears the year too — a bare "'27" means nothing. */}
        {selected && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Clear school"
            className="h-11 w-11 shrink-0 rounded-xl text-muted-foreground"
            onClick={() => {
              onCollegeChange(null);
              onClassYearChange(null);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Year only matters once a school is set, and it's what separates an
          alum from a current student. */}
      {selected && (
        <Select
          value={classYear ? String(classYear) : ""}
          onValueChange={(v) => onClassYearChange(v ? Number(v) : null)}
          disabled={disabled}
        >
          <SelectTrigger className="h-11 rounded-xl" aria-label="Class year">
            <SelectValue placeholder="Class year (optional)" />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                Class of {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
