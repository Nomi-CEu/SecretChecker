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
### Success
Whether all secrets in `check` are present and set to a non empty-string value. Output is a string; `true` if all secrets are present and set; `false` otherwise.

## Why Separate Action?
This is to allow reusability between repos and actions.

The checks take place in js rather than via cli (e.g. with `jq`) to prevent secrets from being fed into command line processes (see [GitHub Docs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets#using-secrets-in-a-workflow) for why this is dangerous)
