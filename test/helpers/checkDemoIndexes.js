'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
module.exports=function checkDemoIndexes(){
  const root=path.join(__dirname,'../../demos');
  for(const name of ['index.md','amcaf-examples.md','tutorial.md','compiler-examples.md']){
    const source=fs.readFileSync(path.join(root,name),'utf8');
    assert(source.startsWith('# '),name+' is Markdown');
    assert(!fs.existsSync(path.join(root,name.replace('.md','.html'))),name+' replaces the HTML catalogue');
    for(const [,target]of source.matchAll(/\]\(([^)]+)\)/g)){
      if(target.startsWith('https://htmlpreview.github.io/')){
        assert(target.startsWith('https://htmlpreview.github.io/?https://github.com/dschwen/AMOScript/blob/master/demos/'),target);
        const file=target.split('/demos/')[1];assert(file.endsWith('.html'),target);assert(fs.existsSync(path.join(root,file)),target);
      }else if(!/^(https?:|#)/.test(target))assert(fs.existsSync(path.resolve(root,target)),target);
    }
  }
  const retired=['index.html','amcaf-examples.html','tutorial.html','compiler-examples.html'];
  for(const file of fs.readdirSync(root).filter(file=>file.endsWith('.html'))){
    const html=fs.readFileSync(path.join(root,file),'utf8');
    for(const [,href]of html.matchAll(/<a href="([^"]+)"/g)){
      assert(!retired.includes(href),file+' links to retired catalogue '+href);
      for(const name of retired)assert(!href.endsWith('/demos/'+name),file+' links to retired catalogue '+href);
    }
  }
  const index=fs.readFileSync(path.join(root,'index.md'),'utf8');
  for(const entry of require('../../demos/manifest.json').scenarios)assert(index.includes(entry.preview),entry.file+' is discoverable');
  assert(index.indexOf('## Play the games')<index.indexOf('## Technical checks'));
  assert.match(index,/<details>\n<summary>Compiler and runtime checks/);
  assert.doesNotMatch(index,/<details open/);
};
