"""Normalize extracted PDF whitespace without discarding source concepts."""
import json,re
pages=json.load(open('content/source-pages.json'))
bank=json.load(open('content/approved-question-bank.json'))
headings=['PHILOSOPHICAL PERSPECTIVES OF THE SELF','THE SELF, SOCIETY, AND CULTURE','ANTHROPOLOGICAL CONCEPTUALIZATION OF THE SELF','PSYCHOLOGICAL PERSPECTIVES OF THE SELF']
text=' '.join(re.sub(r'\s+',' ',p['text']).strip() for p in pages)
lessons=[]
for i,meta in enumerate(bank['subject']['lessons']):
 start=text.index(headings[i])+len(headings[i]);end=text.index(headings[i+1]) if i<3 else len(text)
 body=text[start:end].strip()
 # Numbered top-level headings always follow a period and precede a bullet.
 pattern=r'(?:^|(?<= ))(\d+\. (?:Socrates|Plato|Aristotle|St\. Augustine|René Descartes|John Locke|David Hume|Immanuel Kant|Sigmund Freud|Gilbert Ryle|Paul Churchland|Maurice Merleau-Ponty|Introduction:|The Traditional View|Marcel Mauss:|Institutions That|Sociological Theories|Modern vs\.|Self as Embedded|Cultural Construction|Egocentric vs\.|Identity Toolbox|Rites of Passage|Introduction to Psychology|William James|Carl Rogers|Donald Winnicott|Albert Bandura|Carl Jung|Erik Erikson)[^●]*)(?=●)'
 matches=list(re.finditer(pattern,body));sections=[]
 for j,m in enumerate(matches):
  raw=body[m.end():matches[j+1].start() if j+1<len(matches) else len(body)].strip()
  sections.append({'id':f'{meta["id"]}-{j+1}','title':m.group(1).strip(),'blocks':[x.strip() for x in raw.split('●') if x.strip()]})
 lessons.append({**meta,'sections':sections})
json.dump(lessons,open('content/lessons.json','w'),ensure_ascii=False,indent=2)
print([(l['id'],len(l['sections']),sum(len(s['blocks']) for s in l['sections'])) for l in lessons])
