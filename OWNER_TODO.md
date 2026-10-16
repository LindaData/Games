# Owner to-do: Snailmate Chess

1. DNS for **lindadata.com**: add a **CNAME** record `snailmate` → `cname.vercel-dns.com.` (makes snailmate.lindadata.com live; we switch the links after).
2. Make this GitHub repo **private** (Settings → General → Change visibility).
3. Steam: sign up at partner.steamgames.com, pay the **$100** fee, fill in tax + bank info.
4. Create the app **Snailmate Chess** with **2 depots** and **2 launch options** (Windows, Linux: set each one's Operating System), and a **builder** Steam account.
5. Add **5 GitHub secrets**: `STEAM_USERNAME`, `STEAM_CONFIG_VDF`, `STEAM_APP_ID`, `STEAM_DEPOT_WINDOWS`, `STEAM_DEPOT_LINUX`.
6. Merge the pull request with this work into **main** on GitHub (the release workflow runs from there).
7. Tag main (`git checkout main && git pull && git tag snail-v1.0.0 && git push origin snail-v1.0.0`): the builds land on Steam's **beta** branch. Test, then set live.
8. Vercel → project → **Analytics** → Enable (page views on any plan; the game events need **Pro**).
9. (Optional) Message **ViperKing**, whose Short inspired the game.

Details: [immortal-snail/steam/README.md](immortal-snail/steam/README.md)
