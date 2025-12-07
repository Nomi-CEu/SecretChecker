# SecretChecker

A very simple GitHub Action to see whether secrets are present and set.

## Inputs
### Secrets
Should be secrets in json format. Common way to retrieve this is `${{ toJSON(secrets) }}`.

### Check
Secrets to check; separated by newline.

E.g.
```
SECRET_1
SECRET_2
SECRET_3
```

## Outputs
Aside from GitHub Action outputs, the secrets in `check` that were not set will be printed to log; and if all secrets to check were set, then a success message is printed to log.

### Success
Whether all secrets in `check` are present and set to a non empty-string value. Output is a string; `true` if all secrets are present and set; `false` otherwise.

## Use Cases
See [StackOverflow Discussion](https://stackoverflow.com/questions/70249519/how-to-check-if-a-secret-variable-is-empty-in-if-conditional-github-actions). This helps streamline that process a little; and by reducing code duplication necessary to check secrets dynamically.

If you want to run jobs conditionally based on secrets set, you can even include this action in a small reusable workflow and call that.

## Why Separate Action?
This is to allow reusability between repos and actions.

The checks take place in js rather than via cli (e.g. with `jq`) to prevent secrets from being fed into command line processes (see [GitHub Docs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets#using-secrets-in-a-workflow) for why this is dangerous)
