const fs = require('fs');
const pdf = require('pdf-parse');

const pdfPath = '/home/admin/.openclaw/media/inbound/人格探索局_Persona_Lab_v4.4_最终版产品PR..._2---d89b650b-00b3-456d-ba48-9c2f00c47ed3.pdf';
const dataBuffer = fs.readFileSync(pdfPath);

pdf(dataBuffer)
  .then(function (data) {
    console.log('=== PDF 内容提取 ===');
    console.log('页数:', data.numpages);
    console.log('版本:', data.version);
    console.log('\n=== 完整文本内容 ===');
    console.log(data.text);
  })
  .catch(function (err) {
    console.log('错误:', err);
    process.exit(1);
  });
