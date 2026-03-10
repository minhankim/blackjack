import re

with open('style_raw.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Step 1: Expand compressed CSS - add newlines after ; and after { and before }
# First, normalize: ensure space before {
css = re.sub(r'(\S)\{', r'\1 {', css)

# Expand single-line rules: split properties onto separate lines
lines = css.split('\n')
expanded = []
for line in lines:
    stripped = line.strip()
    if not stripped:
        expanded.append('')
        continue
    # Skip comment lines
    if stripped.startswith('/*') or stripped.startswith('*') or stripped.endswith('*/'):
        expanded.append(stripped)
        continue
    # If line contains { and properties on same line, expand
    # e.g. ".foo {margin:0;padding:0}" -> ".foo {\n  margin:0;\n  padding:0;\n}"
    if '{' in stripped and '}' in stripped and not stripped.startswith('@keyframes') and not stripped.startswith('@media'):
        # Could be multiple rules on one line like ".a {x:1}.b {y:2}"
        # Split by } but keep track
        parts = re.split(r'\}', stripped)
        for j, part in enumerate(parts):
            part = part.strip()
            if not part:
                continue
            if '{' in part:
                selector, body = part.split('{', 1)
                selector = selector.strip()
                body = body.strip()
                if body:
                    props = [p.strip() for p in body.split(';') if p.strip()]
                    expanded.append(selector + ' {')
                    expanded.append('')
                    for k, prop in enumerate(props):
                        if not prop.endswith(';'):
                            prop += ';'
                        expanded.append('  ' + prop)
                        expanded.append('')  # blank line between properties
                    expanded.append('}')
                else:
                    expanded.append(selector + ' {')
            else:
                # Just a closing or leftover
                if part:
                    expanded.append(part)
                expanded.append('}')
    elif '{' in stripped:
        # Opening selector line
        if stripped.endswith('{'):
            expanded.append(stripped)
            expanded.append('')
        else:
            # selector with some props, no closing
            selector, rest = stripped.split('{', 1)
            expanded.append(selector.strip() + ' {')
            expanded.append('')
            props = [p.strip() for p in rest.split(';') if p.strip()]
            for prop in props:
                if not prop.endswith(';'):
                    prop += ';'
                expanded.append('  ' + prop)
                expanded.append('')
    elif '}' in stripped:
        # Remove trailing content after }
        before = stripped.split('}')[0].strip()
        if before:
            props = [p.strip() for p in before.split(';') if p.strip()]
            for prop in props:
                if not prop.endswith(';'):
                    prop += ';'
                expanded.append('  ' + prop)
                expanded.append('')
        expanded.append('}')
        # Check for content after }
        after = stripped.split('}', 1)[1].strip()
        if after:
            expanded.append(after)
    else:
        # Property line or continuation
        # Split multiple properties
        if ';' in stripped and ':' in stripped:
            props = [p.strip() for p in stripped.split(';') if p.strip()]
            for prop in props:
                if not prop.endswith(';'):
                    prop += ';'
                expanded.append('  ' + prop)
                expanded.append('')
        else:
            expanded.append('  ' + stripped if ':' in stripped and not stripped.startswith('@') and not stripped.startswith('/') else stripped)

# Clean up: ensure proper indentation and spacing
result = '\n'.join(expanded)

# Fix: ensure space between selector and {
result = re.sub(r'(\S)\{', r'\1 {', result)

# Remove triple+ blank lines, keep max double
result = re.sub(r'\n{4,}', '\n\n\n', result)

# Remove trailing whitespace
result = '\n'.join(line.rstrip() for line in result.split('\n'))

with open('style.css', 'w', encoding='utf-8') as f:
    f.write(result)

print("Done! Lines:", len(result.split('\n')))
