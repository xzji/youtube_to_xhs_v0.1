from pypdf import PdfReader

reader = PdfReader("docs/产品需求文档：YouTube 视频转小红书图文生成器.pdf")
text = ""
for page in reader.pages:
    text += page.extract_text() + "\n"

# Simple search for 3.1
index = text.find("3.1")
if index != -1:
    print(text[index:index+1000])
else:
    print("Section 3.1 not found, printing first 1000 chars:")
    print(text[:1000])
