import re

with open('frontend/stitched_template.html', 'r', encoding='utf-8') as f:
    html = f.read()

with open('frontend/app_integrated.js', 'r', encoding='utf-8') as sf:
    js_code = sf.read()

# Replace the last <script> (which had the mock demo code) with <script>\n{js_code}\n</script>
m = list(re.finditer(r'<script.*?>.*?</script>', html, re.DOTALL))
print(f"Total script blocks in template: {len(m)}")

last_script = m[-1]
start_pos = last_script.start()
end_pos = last_script.end()

new_html = html[:start_pos] + f"<script>\n{js_code}\n</script>" + html[end_pos:]

with open('frontend/index.html', 'w', encoding='utf-8') as out:
    out.write(new_html)

print(f"Successfully generated frontend/index.html ({len(new_html)} bytes) with live backend integration!")
