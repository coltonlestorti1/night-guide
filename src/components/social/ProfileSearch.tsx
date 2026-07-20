/** Debounced people search — username + display name, self excluded
 *  server-side. Avatar+name tap opens the profile. */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import { useSearchProfiles } from "@/hooks/useFriends";
import { Input } from "@/components/ui/input";
import ProfileAvatar from "@/components/social/ProfileAvatar";
import AddButton from "@/components/social/AddButton";

export default function ProfileSearch() {
  const navigate = useNavigate();
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
              <button
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => navigate(`/u/${p.username}`)}
                aria-label={`View @${p.username}'s profile`}
              >
                <ProfileAvatar profile={p} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">@{p.username}</span>
                  {p.display_name && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.display_name}
                    </span>
                  )}
                </span>
              </button>
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
