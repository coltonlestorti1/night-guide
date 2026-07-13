/** Debounced people search — username + display name, self excluded server-side. */
import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { useSearchProfiles } from "@/hooks/useFriends";
import { Input } from "@/components/ui/input";
import ProfileAvatar from "@/components/social/ProfileAvatar";
import AddButton from "@/components/social/AddButton";

export default function ProfileSearch() {
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");

  // Debounced availability-check pattern from PickUsername
  useEffect(() => {
    const t = setTimeout(() => setTerm(input.trim()), 400);
    return () => clearTimeout(t);
  }, [input]);

  const { data: results, isFetching } = useSearchProfiles(term);
  const searching = term.length >= 2;

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search by username or name"
          className="pl-9 h-11 rounded-xl"
          aria-label="Search people"
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {searching && results && results.length > 0 && (
        <div className="mt-1">
          {results.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2.5">
              <ProfileAvatar profile={p} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">@{p.username}</p>
                {p.display_name && (
                  <p className="text-xs text-muted-foreground truncate">{p.display_name}</p>
                )}
              </div>
              <AddButton profile={p} />
            </div>
          ))}
        </div>
      )}
      {searching && results && results.length === 0 && !isFetching && (
        <p className="text-sm text-muted-foreground py-3">No one by that name yet.</p>
      )}
    </div>
  );
}
