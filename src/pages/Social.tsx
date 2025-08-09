const Social = () => {
  return (
    <section className="container pt-6 pb-4">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Social</h1>
        <p className="text-sm text-muted-foreground">Friends already here</p>
      </header>
      <div className="text-center bg-card border rounded-lg p-6">
        <p className="text-muted-foreground">No friend check-ins yet.</p>
        <a href="/profile" className="underline mt-2 inline-block">Connect Data</a>
      </div>
    </section>
  );
};

export default Social;
