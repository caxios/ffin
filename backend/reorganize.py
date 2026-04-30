import os
import shutil
import re
import sys

BASE_DIR = r"c:\ffin\backend"

# Define the structure
STRUCTURE = {
    "form4": [
        "form4_db.py",
        "form4_parser.py",
        "sec_form4_rss.py",
        "sec_form4_watchlist.py"
    ],
    "sec_10kq": [
        "sec_10kq_db.py",
        "sec_10kq_parser.py",
        "sec_10kq_pipeline.py",
        "sec_10kq_rss.py"
    ],
    "earnings": [
        "earnings_transcripts_db.py",
        "tavily_transcripts.py"
    ],
    "company_facts": [
        "company_facts_db.py",
        "company_specific_fin.py",
        "backfill_market_cap.py"
    ]
}

# 1. Create folders, __init__.py, and move files
for folder, files in STRUCTURE.items():
    folder_path = os.path.join(BASE_DIR, folder)
    os.makedirs(folder_path, exist_ok=True)
    
    init_file = os.path.join(folder_path, "__init__.py")
    if not os.path.exists(init_file):
        with open(init_file, "w") as f:
            f.write("")
            
    for file in files:
        src = os.path.join(BASE_DIR, file)
        dst = os.path.join(folder_path, file)
        if os.path.exists(src):
            shutil.move(src, dst)
            print(f"Moved {file} -> {folder}/")

# 2. Update imports in all Python files
def update_file(filepath):
    if not os.path.exists(filepath):
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # app.py imports
    content = re.sub(r'from sec_form4_watchlist import', r'from form4.sec_form4_watchlist import', content)
    content = re.sub(r'from form4_parser import', r'from form4.form4_parser import', content)
    content = re.sub(r'from form4_db import', r'from form4.form4_db import', content)
    content = re.sub(r'from tavily_transcripts import', r'from earnings.tavily_transcripts import', content)

    # internal package imports
    content = re.sub(r'from sec_10kq_rss import', r'from sec_10kq.sec_10kq_rss import', content)
    content = re.sub(r'from sec_10kq_parser import', r'from sec_10kq.sec_10kq_parser import', content)
    content = re.sub(r'from sec_10kq_db import', r'from sec_10kq.sec_10kq_db import', content)
    
    content = re.sub(r'from earnings_transcripts_db import', r'from earnings.earnings_transcripts_db import', content)

    # Inject sys.path modification before 'from const import HEADERS'
    # so that scripts can still be run directly from their new subdirectories
    sys_path_injection = """import sys
import os
# Ensure parent directory is in path so we can import const
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from const import HEADERS"""
    
    # Only inject if not app.py or const.py
    if not filepath.endswith("app.py") and not filepath.endswith("const.py"):
        if "from const import HEADERS" in content and "sys.path.append" not in content:
            content = content.replace("from const import HEADERS", sys_path_injection)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

# Update app.py
update_file(os.path.join(BASE_DIR, "app.py"))

# Update all moved files
for folder, files in STRUCTURE.items():
    for file in files:
        update_file(os.path.join(BASE_DIR, folder, file))

print("Reorganization complete.")
