-- Chat source URLs were built by passing the thread resource path ("spaces/<S>/threads/<T>")
-- through encodeURIComponent, which turned the path separators into %2F. Google Chat cannot route
-- an encoded path, so the link only opened the app root instead of the thread. Decode the separators
-- back to real slashes so existing actions deep-link correctly (the generator is fixed in code too).
UPDATE action
SET source_url = REPLACE(source_url, '%2F', '/')
WHERE source_type = 'chat' AND instr(source_url, '%2F') > 0;
