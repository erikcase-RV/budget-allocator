# Creating Repositories in the Bankrate GitHub Org

Repos created in personal GitHub accounts are not visible to Bankrate colleagues by default. To share repos across teams, they must be created in the **Bankrate GitHub org** using **Conductor**.

## Why Use Conductor?

Personal repos (e.g., `github.com/erikcase-RV/...`):
- Require manual access grants for each collaborator
- Not part of the Bankrate org
- Missing team permissions and business division accreditation

Org repos (e.g., `github.com/bankrate/...`):
- Automatically visible to appropriate teams
- Proper access controls via team membership
- Business unit tagging for compliance

## Prerequisites

1. **GitHub Personal Access Token (PAT)**
   - Create at: https://github.com/settings/tokens
   - Ensure it is authenticated with the Bankrate org
   - Required scopes: `repo`, `admin:org` (for repo creation)

2. **Add token to shell config**
   ```bash
   # Add to ~/.zshrc (or ~/.bashrc)
   export GITHUB_TOKEN="your_token_here"
   ```
   Then reload: `source ~/.zshrc`

3. **Install Conductor via npm**
   ```bash
   npm install -g @bankrate/conductor
   ```
   
   If you get permission errors like:
   ```
   npm error Error: EACCES: permission denied, mkdir '/usr/local/lib/node_modules/@bankrate'
   ```
   
   Fix by setting npm to use a directory in your home folder:
   ```bash
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
   source ~/.zshrc
   ```

## Creating a Repo

Run:
```bash
conductor github create-repo
```

You will be prompted for:

| Prompt | Example Value |
|--------|---------------|
| Organization name | `bankrate` |
| Repo name | `budget-allocator` |
| Repo description | `Multi-platform paid media budget allocation tool` |
| Repo visibility | `internal` (accessible to everyone in the org) |
| Team to add | `Data Science` |
| Business unit | `banking-corporate (b500)` |
| Add Terraform workspace? | `No` (unless needed for infra) |

After completion, Conductor will output the new repo URL.

## After Repo Creation

1. Update the remote in your local repo:
   ```bash
   git remote set-url origin https://github.com/bankrate/budget-allocator.git
   ```

2. Push your code:
   ```bash
   git push -u origin main
   ```

## Reference

- Conductor docs: https://github.com/bankrate/conductor
- GitHub PAT setup: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token
