import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

const Social = () => {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);

  return (
    <section className="container pt-6 pb-24 max-w-lg">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Social</h1>
        <p className="text-sm text-muted-foreground">Find out where your friends are tonight</p>
      </header>
      <div className="glass rounded-3xl p-8 text-center animate-fade-in">
        <Users className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
        <p className="font-medium">No friend check-ins yet.</p>
        <p className="text-sm text-muted-foreground mt-1">
          {status === "signedIn"
            ? "Adding friends is coming soon — your crew shows up here the moment they check in."
            : "Sign in to add friends and see where they're at."}
        </p>
        {status === "signedOut" && (
          <Button className="w-full h-11 rounded-xl mt-5" onClick={() => navigate("/profile")}>
            Sign in
          </Button>
        )}
      </div>
    </section>
  );
};

export default Social;
