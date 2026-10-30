# Builds data.js from content/*.json (module order: PPR I-VIII, then BHP I-II).
import json, os
here = os.path.dirname(os.path.abspath(__file__))
order = [f"ppr{i}" for i in range(1, 9)] + ["bhp1", "bhp2"]
modules = []
for module_id in order:
    path = os.path.join(here, "content", module_id + ".json")
    if not os.path.exists(path):
        print("missing", module_id); continue
    m = json.load(open(path))
    for q in m["quiz"]:
        assert len(q["options"]) == 4 and 0 <= q["answer"] <= 3, (module_id, q["q"])
    modules.append(m)
    print(module_id, len(m["notes"]), "sections", len(m["flashcards"]), "cards", len(m["quiz"]), "questions")
with open(os.path.join(here, "data.js"), "w") as f:
    f.write("const COURSE_DATA = " + json.dumps(modules, ensure_ascii=False) + ";\n")
