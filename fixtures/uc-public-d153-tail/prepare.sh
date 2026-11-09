#!/usr/bin/env bash
set -euo pipefail
target="$GITHUB_WORKSPACE/public-source"
packet="$GITHUB_WORKSPACE/fixtures/uc-public-d153-tail"
test "$(git -C "$target" rev-parse HEAD)" = d153c5b5e811f5cc367e193adfa843fbf1af9c18
test "$(git -C "$target" rev-parse HEAD^{tree})" = e1f3f61910b37afbe68a9b0ba3d54253e88507be
python3 "$packet/verify-overlay.py" "$target" "$packet"
work="$RUNNER_TEMP/uc-public-d153-tail"
mkdir -p "$work/build" "$target/reports/private-tail"
python3 "$packet/runner-space.py" "$target/reports/private-tail/runner-space.json"
cp "$target/package.json" "$target/pnpm-lock.yaml" "$target/pnpm-workspace.yaml" "$work/build/"
cp "$packet/Dockerfile" "$work/build/Dockerfile"
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --max-redirs 2 --max-time 90 --retry 1 --retry-max-time 180 --max-filesize 80000000 -o "$work/build/node.tar.xz" https://nodejs.org/dist/v24.22.2/node-v24.22.2-linux-x64.tar.xz
echo '48cc0e21e048790e54c0cf5749c2725005313d652651c40b7a21feb9697aaf75  '"$work/build/node.tar.xz" | sha256sum --check
docker build --tag security-public-d153-tail "$work/build"
# Preparation mirrors the already authorized public CI build. No token or
# Cloudflare/AI credentials are passed into the container. Tests run separately
# with no external network, after the immutable public media has been restored.
timeout --kill-after=15s 5400s docker run --rm --init --network bridge --read-only --ipc private --shm-size=1g --cpus 4 --memory 6g --memory-swap 6g --pids-limit 512 --cap-drop ALL --security-opt no-new-privileges --tmpfs /scratch:rw,nosuid,nodev,exec,size=1073741824,mode=1777 --mount "type=bind,src=$target,dst=/work" --mount "type=bind,src=$packet,dst=/harness,readonly" --user "$(id -u):$(id -g)" --entrypoint /usr/bin/env security-public-d153-tail -i PATH=/opt/node24/bin:/manager/node_modules/.bin:/usr/local/bin:/usr/bin:/bin HOME=/scratch/home TMPDIR=/scratch/tmp XDG_CACHE_HOME=/scratch/cache ASTRO_TELEMETRY_DISABLED=1 CI=true LANG=C.UTF-8 TZ=UTC NODE_OPTIONS=--max-old-space-size=4500 /bin/bash -c 'set -euo pipefail; mkdir -p /scratch/home /scratch/tmp /scratch/cache; cd /work; mkdir -p node_modules; cp -R /deps/node_modules/. node_modules/; npm run build' 2>&1 | tee "$target/reports/private-tail/build.log"

timeout 600s docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --mount "type=bind,src=$target,dst=/work" --mount "type=bind,src=$packet,dst=/harness,readonly" --user "$(id -u):$(id -g)" --entrypoint python3 security-public-d153-tail /harness/verify-media.py after-build
