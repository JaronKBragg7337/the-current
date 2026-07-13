# Security and privacy

The Current is designed to run without application secrets. Public data adapters must use credential-free endpoints by default, and the core simulation must remain functional offline.

Never commit API keys, tokens, browser profiles, cookies, authentication state, private documents, personal datasets, or machine-specific secrets. Put local values in ignored `.env` files and keep downloaded source archives in the ignored `assets/source-cache/` directory.

Report a security issue privately to the repository owner rather than opening a public issue containing exploit details or credentials.

