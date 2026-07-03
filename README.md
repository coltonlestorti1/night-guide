# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/3b90c921-395a-43d6-9df8-33eae779fc96

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/3b90c921-395a-43d6-9df8-33eae779fc96) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Configuration

The map needs a Mapbox public token to render.

**Local development:**
1. Copy `.env.example` to `.env.local`
2. Get a free token at [account.mapbox.com/access-tokens](https://account.mapbox.com/access-tokens/) (50,000 map loads/month free)
3. Set `VITE_MAPBOX_TOKEN=pk.your_token` in `.env.local`
4. Restart `npm run dev` (Vite only reads env files at server start)

Without a token set, the app still runs — it falls back to a manual-entry screen where you can paste a token directly (handy for quick testing without touching `.env.local`).

**Production (Vercel):** set `VITE_MAPBOX_TOKEN` as an environment variable in the Vercel project settings (Project → Settings → Environment Variables) before deploying. Also add your production domain to the token's URL restrictions in the Mapbox dashboard (account.mapbox.com → your token → "URL restrictions") so the token can't be used from other sites.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/3b90c921-395a-43d6-9df8-33eae779fc96) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
