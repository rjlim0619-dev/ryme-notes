/* runs before the page paints: theme + anti-clickjacking (refuse to run inside someone else's frame) */
(function(){
  if(window.top!==window.self){document.documentElement.style.display='none';try{window.top.location=window.self.location}catch(e){}return}
  var t='dark';try{t=localStorage.getItem('rymeNotes.theme2')||'dark'}catch(e){}
  document.documentElement.dataset.theme=t;
})();
