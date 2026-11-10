# copy the app's real lib files, renaming imports to .mjs so node can run them
rm -rf lib && mkdir lib
for f in clean learning pantry safety approved-rules; do
  [ -f /home/claude/nutritrack/lib/$f.js ] && sed -E 's#from "\./([a-z-]+)"#from "./\1.mjs"#' /home/claude/nutritrack/lib/$f.js > lib/$f.mjs
done
