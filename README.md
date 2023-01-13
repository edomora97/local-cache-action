# Local Cache Action

This GitHub Action tries to replicate the behavior of [actions/cache](https://github.com/actions/cache), but for self-hosted runners.
Instead of uploading and downloading the cache into Github servers, this stores the cache files locally in a folder mounted in the runner.

## Usage

The inputs and outputs are the same of the [actions/cache](https://github.com/actions/cache) action, with the addition of the `cache-dir` input: the absolute path to the directory where to store the cache files. This directory must be writable by the runner's user.

```yaml
name: Test
on: push
jobs:
  test:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v3
      - uses: edomora97/local-cache-action@v1
        with:
          cache-dir: /cache
          path: |
            node_modules
            dist/**
          key: ${{ runner.os }}-v1-${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-v1
      # ...
```

The implementation is a lot simpler than the official one, and therefore it makes some simplifying assumptions. For example, it uses `tar -I "zstd -T0"` for compressing and decompressing the archive which may not be supported by your OS/distribution.

## Contributing

After making code change run: `npm run package`
