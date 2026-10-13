(function(){
  var $=function(s,r){return (r||document).querySelector(s)};
  var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PAL=['#ff7a9c','#ffd3df','#ffb020','#fff4ea','#ff9a76'];
  var dpr=Math.min(window.devicePixelRatio||1,2);
  var rnd=Math.random;

  /* ---------- confetti layer ---------- */
  var fx=$('#fx'),fctx=fx.getContext('2d'),W=0,H=0,pieces=[],fxRun=false;
  function sizeFx(){W=innerWidth;H=innerHeight;fx.width=W*dpr;fx.height=H*dpr;fctx.setTransform(dpr,0,0,dpr,0,0)}
  function burst(x,y,n,spread,dir,power){
    power=power||1;
    for(var i=0;i<n;i++){
      var a=dir+(rnd()-.5)*spread,v=(7+rnd()*10)*power;
      pieces.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,g:.2,d:.985,w:6+rnd()*6,h:3+rnd()*4,r:rnd()*6.28,vr:(rnd()-.5)*.4,ph:rnd()*6,c:PAL[(rnd()*PAL.length)|0],life:0,max:130+rnd()*90,dot:rnd()<.2});
    }
    startFx();
  }
  function rain(n){
    for(var i=0;i<n;i++){
      pieces.push({x:rnd()*W,y:-20-rnd()*H*.5,vx:(rnd()-.5)*2,vy:1.5+rnd()*2.5,g:.06,d:.985,w:6+rnd()*6,h:3+rnd()*4,r:rnd()*6.28,vr:(rnd()-.5)*.25,ph:rnd()*6,c:PAL[(rnd()*PAL.length)|0],life:0,max:600,dot:rnd()<.2});
    }
    startFx();
  }
  function startFx(){if(!fxRun){fxRun=true;requestAnimationFrame(tickFx)}}
  function tickFx(){
    fctx.clearRect(0,0,W,H);
    pieces=pieces.filter(function(p){return p.life<p.max&&p.y<H+30});
    for(var i=0;i<pieces.length;i++){
      var p=pieces[i];
      p.vx*=p.d;p.vy=p.vy*p.d+p.g;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;p.life++;
      var a=Math.min(1,(p.max-p.life)/25);
      fctx.save();fctx.globalAlpha=a<0?0:a;fctx.translate(p.x,p.y);fctx.rotate(p.r);
      fctx.scale(Math.cos(p.life*.15+p.ph),1);fctx.fillStyle=p.c;
      if(p.dot){fctx.beginPath();fctx.arc(0,0,p.h*.9,0,6.283);fctx.fill()}else{fctx.fillRect(-p.w/2,-p.h/2,p.w,p.h)}
      fctx.restore();
    }
    if(pieces.length){requestAnimationFrame(tickFx)}else{fxRun=false;fctx.clearRect(0,0,W,H)}
  }
  function party(){
    burst(innerWidth*.12,innerHeight*.95,80,1.1,-Math.PI/4,1.1);
    burst(innerWidth*.88,innerHeight*.95,80,1.1,-3*Math.PI/4,1.1);
    rain(110);
  }

  /* ---------- floating hearts + sparkles behind everything ---------- */
  var bg=$('#bg'),bctx=bg.getContext('2d'),BW=0,BH=0,motes=[];
  function heart(c,x,y,s){
    c.beginPath();c.moveTo(x,y+s);
    c.bezierCurveTo(x-s*1.4,y-s*.1,x-s*.6,y-s,x,y-s*.35);
    c.bezierCurveTo(x+s*.6,y-s,x+s*1.4,y-s*.1,x,y+s);c.fill();
  }
  function sizeBg(){BW=innerWidth;BH=innerHeight;bg.width=BW*dpr;bg.height=BH*dpr;bctx.setTransform(dpr,0,0,dpr,0,0)}
  function makeMotes(){
    motes=[];var n=BW<600?22:38;
    for(var i=0;i<n;i++){motes.push({x:rnd()*BW,y:rnd()*BH,s:2+rnd()*5,vy:.15+rnd()*.35,ph:rnd()*6,a:.12+rnd()*.3,h:rnd()<.45,c:rnd()<.5?'#ff7a9c':(rnd()<.5?'#ffb020':'#fff4ea')})}
  }
  function drawBg(t){
    bctx.clearRect(0,0,BW,BH);
    for(var i=0;i<motes.length;i++){
      var m=motes[i];
      if(!reduce){m.y-=m.vy;m.x+=Math.sin(t*.0008+m.ph)*.25;if(m.y<-20){m.y=BH+20;m.x=rnd()*BW}}
      bctx.globalAlpha=m.a;bctx.fillStyle=m.c;
      if(m.h){heart(bctx,m.x,m.y,m.s)}else{bctx.beginPath();bctx.arc(m.x,m.y,m.s*.35,0,6.283);bctx.fill()}
    }
    bctx.globalAlpha=1;
    if(!reduce){requestAnimationFrame(drawBg)}
  }

  /* ---------- countdown ---------- */
  var TARGET=new Date('2026-10-13T00:00:00+05:30').getTime(),DAY=864e5;
  var eD=$('#cd-d'),eH=$('#cd-h'),eM=$('#cd-m'),eS=$('#cd-s'),tiles=$('#tiles'),lab=$('#cd-label'),msg=$('#cd-msg');
  function pad(n){return String(n).padStart(2,'0')}
  function tickCd(){
    var d=TARGET-Date.now();
    if(d>0){
      var s=Math.floor(d/1000);
      eD.textContent=pad(Math.floor(s/86400));eH.textContent=pad(Math.floor(s%86400/3600));
      eM.textContent=pad(Math.floor(s%3600/60));eS.textContent=pad(s%60);
      tiles.hidden=false;msg.hidden=true;lab.textContent='Until you turn 25';
    }else if(d>-DAY){
      tiles.hidden=true;msg.hidden=false;lab.textContent='Right now';
      msg.textContent='Today is the day. Happy 25th birthday, Meghana!';
    }else{
      tiles.hidden=true;msg.hidden=false;lab.textContent='Your 25th year';
      msg.textContent='Twenty-five has begun. Here is to every day of it.';
    }
  }
  tickCd();setInterval(tickCd,1000);

  /* ---------- 25 years strip ---------- */
  var years=$('#years');
  for(var k=0;k<25;k++){var b=document.createElement('i');b.style.setProperty('--k',k);years.appendChild(b)}

  /* ---------- count up numbers ---------- */
  function countUp(el,to,dur){
    if(reduce)return;
    var t0=performance.now();
    function f(t){
      var p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);
      el.textContent=Math.round(to*e).toLocaleString('en-IN');
      if(p<1){requestAnimationFrame(f)}else{el.textContent=to.toLocaleString('en-IN')}
    }
    requestAnimationFrame(f);
  }
  var quarter=$('#quarter'),qDone=false;
  new IntersectionObserver(function(es){
    if(es[0].isIntersecting&&!qDone){
      qDone=true;years.classList.add('play');
      $$('[data-to]').forEach(function(el){countUp(el,+el.getAttribute('data-to'),1800)});
    }
  },{threshold:.25}).observe(quarter);

  /* ---------- reveal on scroll ---------- */
  var io=new IntersectionObserver(function(es){
    es.forEach(function(e){if(e.isIntersecting){e.target.classList.remove('pre');io.unobserve(e.target)}});
  },{threshold:.1});
  $$('.rv').forEach(function(el){
    if(el.getBoundingClientRect().top>innerHeight*.92){el.classList.add('pre')}
    io.observe(el);
  });

  /* ---------- birthday tune ---------- */
  var SONG=[[392,.75],[392,.25],[440,1],[392,1],[523.25,1],[493.88,2],
            [392,.75],[392,.25],[440,1],[392,1],[587.33,1],[523.25,2],
            [392,.75],[392,.25],[783.99,1],[659.25,1],[523.25,1],[493.88,1],[440,2],
            [698.46,.75],[698.46,.25],[659.25,1],[523.25,1],[587.33,1],[523.25,2]];
  var actx=null;
  function playSong(){
    if(!$('#sound').checked)return;
    try{
      if(actx){actx.close();actx=null}
      var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
      actx=new AC();
      var master=actx.createGain();master.gain.value=.16;master.connect(actx.destination);
      var beat=.44,t=actx.currentTime+.05;
      SONG.forEach(function(n){
        var o=actx.createOscillator(),g=actx.createGain();
        o.type='triangle';o.frequency.value=n[0];
        g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(1,t+.02);
        g.gain.exponentialRampToValueAtTime(.001,t+n[1]*beat*.95);
        o.connect(g);g.connect(master);o.start(t);o.stop(t+n[1]*beat);
        t+=n[1]*beat;
      });
    }catch(e){}
  }
  $('#sound').addEventListener('change',function(){
    if(!this.checked&&actx){try{actx.close()}catch(e){}actx=null}
  });

  /* ---------- cake ---------- */
  var cake=$('#cake'),blow=$('#blow'),relight=$('#relight'),again=$('#again'),status=$('#status');
  blow.addEventListener('click',function(){
    cake.classList.add('out');blow.hidden=true;relight.hidden=false;again.hidden=false;
    var r=cake.getBoundingClientRect();
    burst(r.left+r.width/2,r.top+r.height*.3,130,Math.PI*2,-Math.PI/2,.9);
    status.textContent='Your wish is on its way. Happy birthday, Meghana.';
    playSong();
  });
  relight.addEventListener('click',function(){
    cake.classList.remove('out');relight.hidden=true;again.hidden=true;blow.hidden=false;
    status.textContent='The candles are lit again. Make another wish.';
    if(actx){try{actx.close()}catch(e){}actx=null}
  });
  again.addEventListener('click',playSong);

  /* ---------- wishes ---------- */
  var WISHES=[
    'May this year begin with a morning that feels completely yours.',
    'May the people you love call right when you need a friendly voice.',
    'May every plan you make this year turn out better than you drew it.',
    'May you laugh until your cheeks hurt at least once a week.',
    'May you get time to rest and never feel guilty about it.',
    'May all your code run without a single short dump.',
    'May every flight between us land on time.',
    'May your good days be long and your hard days be short.',
    'May you try something new this year and love it.',
    'May you eat something delicious today, and keep the last bite.',
    'May the things you worry about turn out to be nothing.',
    'May the things you hope for turn out to be real.',
    'May you feel as confident as everyone around you already sees you.',
    'May I never leave a laptop anywhere ever again.',
    'May the right song start playing at the right moment.',
    'May you feel proud of how far you have come.',
    'May a surprise find you this year and make you smile.',
    'May your year be full of sunsets worth stopping for.',
    'May the kindness you give come back to you twice over.',
    'May the day come soon when Delhi and Nagpur feel like one city.',
    'May you learn one thing this year that you keep for life.',
    'May your home always feel warm and your people always feel close.',
    'May you remember this day whenever you start to doubt yourself.',
    'May you sleep well, wake up rested and start every day lightly.',
    'May twenty-five be the year everything starts to fall into place.'
  ];
  var grid=$('#w-grid'),wText=$('#w-text'),wMeta=$('#w-meta'),wGhost=$('#w-ghost'),wBar=$('#w-bar'),wCount=$('#w-count');
  var opened={0:true},openCount=1,cur=0,celebrated=false,btns=[];
  WISHES.forEach(function(_,i){
    var b=document.createElement('button');
    b.type='button';b.className='wish-btn';b.textContent=i+1;b.setAttribute('aria-label','Open wish '+(i+1));
    b.addEventListener('click',function(){show(i)});
    grid.appendChild(b);btns.push(b);
  });
  function show(i){
    cur=i;
    if(!opened[i]){opened[i]=true;openCount++}
    btns.forEach(function(b,j){
      b.classList.toggle('on',j===i);
      b.classList.toggle('done',!!opened[j]&&j!==i);
      if(j===i){b.setAttribute('aria-current','true')}else{b.removeAttribute('aria-current')}
    });
    wText.textContent=WISHES[i];wMeta.textContent='Wish '+(i+1)+' of 25';wGhost.textContent=i+1;
    wText.classList.remove('pop');void wText.offsetWidth;wText.classList.add('pop');
    wBar.style.width=Math.max(4,openCount/25*100)+'%';
    wCount.textContent=openCount+' of 25 opened';
    if(openCount===25&&!celebrated){
      celebrated=true;party();
      wCount.textContent='All 25 opened. Happy birthday!';
    }
  }
  $('#w-rand').addEventListener('click',function(){
    var left=[];for(var i=0;i<25;i++){if(!opened[i])left.push(i)}
    var pool=left.length?left:WISHES.map(function(_,i){return i});
    show(pool[(rnd()*pool.length)|0]);
  });
  show(0);

  /* ---------- night sky fireworks ---------- */
  var stars=$('#stars');
  for(var si=0;si<70;si++){
    var st=document.createElement('i');
    st.style.cssText='left:'+(rnd()*100)+'%;top:'+(rnd()*100)+'%;--z:'+(1+rnd()*2.2)+'px;--t:'+(1.5+rnd()*3)+'s;--dl:'+(rnd()*3)+'s';
    stars.appendChild(st);
  }
  var sky=$('#sky'),sctx=sky.getContext('2d'),SW=0,SH=0,rockets=[],sparks=[],skyRun=false,skyVisible=false,autoTimer=null;
  function sizeSky(){var r=sky.getBoundingClientRect();SW=r.width;SH=r.height;sky.width=SW*dpr;sky.height=SH*dpr;sctx.setTransform(dpr,0,0,dpr,0,0)}
  function launch(tx,ty){
    rockets.push({sx:tx+(rnd()-.5)*90,tx:tx,ty:ty,t:0,dur:38+rnd()*16,c:PAL[(rnd()*PAL.length)|0],x:0,y:SH});
    startSky();
  }
  function explode(x,y,c){
    var n=70+((rnd()*40)|0),c2=PAL[(rnd()*PAL.length)|0];
    for(var i=0;i<n;i++){
      var a=rnd()*6.283,v=(.6+Math.pow(rnd(),.6)*4.2);
      sparks.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:0,max:55+rnd()*35,c:rnd()<.7?c:c2,s:1.6+rnd()*1.4});
    }
  }
  function startSky(){if(!skyRun){skyRun=true;requestAnimationFrame(tickSky)}}
  function tickSky(){
    sctx.clearRect(0,0,SW,SH);
    var i,r,p;
    for(i=rockets.length-1;i>=0;i--){
      r=rockets[i];r.t++;
      var k=r.t/r.dur,e=1-Math.pow(1-k,2);
      r.x=r.sx+(r.tx-r.sx)*k;r.y=SH+(r.ty-SH)*e;
      sctx.globalAlpha=1;sctx.fillStyle='#fff4ea';sctx.beginPath();sctx.arc(r.x,r.y,2.2,0,6.283);sctx.fill();
      sctx.globalAlpha=.4;sctx.fillStyle=r.c;sctx.beginPath();sctx.arc(r.x,r.y+7,3.2,0,6.283);sctx.fill();
      if(k>=1){explode(r.tx,r.ty,r.c);rockets.splice(i,1)}
    }
    for(i=sparks.length-1;i>=0;i--){
      p=sparks[i];p.life++;
      var px=p.x,py=p.y;
      p.vx*=.975;p.vy=p.vy*.975+.05;p.x+=p.vx;p.y+=p.vy;
      var a=1-p.life/p.max;
      if(a<=0){sparks.splice(i,1);continue}
      sctx.globalAlpha=a*a;sctx.strokeStyle=p.c;sctx.lineWidth=p.s;sctx.lineCap='round';
      sctx.beginPath();sctx.moveTo(px-p.vx*1.5,py-p.vy*1.5);sctx.lineTo(p.x,p.y);sctx.stroke();
    }
    sctx.globalAlpha=1;
    if(rockets.length||sparks.length){requestAnimationFrame(tickSky)}else{skyRun=false}
  }
  sky.addEventListener('pointerdown',function(e){
    var r=sky.getBoundingClientRect();launch(e.clientX-r.left,e.clientY-r.top);
  });
  function autoShow(){
    if(!skyVisible||reduce)return;
    launch(SW*(.15+rnd()*.7),SH*(.12+rnd()*.4));
    autoTimer=setTimeout(autoShow,1300+rnd()*1000);
  }
  new IntersectionObserver(function(es){
    skyVisible=es[0].isIntersecting;
    clearTimeout(autoTimer);
    if(skyVisible){sizeSky();autoShow()}
  },{threshold:.2}).observe($('#night'));

  /* ---------- memories wall + viewer ---------- */
  var PHOTOS=window.PHOTOS||[];
  var wall=$('#wall'),lb=$('#lb'),lbImg=$('#lb-img'),lbCap=$('#lb-cap'),lbCount=$('#lb-count'),lbIdx=0,lastFocus=null;
  var tilts=[-2.2,1.6,-1.2,2.4,-1.8,1.2,-2.6,1.9,-1,2.1,-1.5],pols=[];
  PHOTOS.forEach(function(p,i){
    var b=document.createElement('button');
    b.type='button';b.className='pol';
    b.style.setProperty('--r',tilts[i%tilts.length]+'deg');
    b.style.setProperty('--d',((i%3)*.12)+'s');
    b.setAttribute('aria-label','Open photo: '+p.cap);
    var im=document.createElement('img');im.src=p.src;im.alt=p.alt;im.width=p.w;im.height=p.h;im.decoding='async';
    var sp=document.createElement('span');sp.textContent=p.cap;
    b.appendChild(im);b.appendChild(sp);
    b.addEventListener('click',function(){openLb(i)});
    wall.appendChild(b);pols.push(b);
  });
  var gio=new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(e.isIntersecting){
        var t=e.target;t.classList.remove('pre');gio.unobserve(t);
        setTimeout(function(){t.style.setProperty('--d','0s')},1400);
      }
    });
  },{threshold:.08});
  pols.forEach(function(b){
    if(b.getBoundingClientRect().top>innerHeight*.92){b.classList.add('pre')}
    gio.observe(b);
  });
  function showLb(i){
    lbIdx=(i+PHOTOS.length)%PHOTOS.length;var p=PHOTOS[lbIdx];
    lbImg.src=p.src;lbImg.alt=p.alt;lbCap.textContent=p.cap;lbCount.textContent=(lbIdx+1)+' / '+PHOTOS.length;
  }
  function openLb(i){
    lastFocus=document.activeElement;showLb(i);lb.hidden=false;
    document.documentElement.style.overflow='hidden';$('#lb-close').focus();
  }
  function closeLb(){
    lb.hidden=true;document.documentElement.style.overflow='';
    if(lastFocus&&lastFocus.focus){lastFocus.focus()}
  }
  $('#lb-close').addEventListener('click',closeLb);
  $('#lb-prev').addEventListener('click',function(){showLb(lbIdx-1)});
  $('#lb-next').addEventListener('click',function(){showLb(lbIdx+1)});
  lb.addEventListener('click',function(e){if(e.target===lb)closeLb()});
  document.addEventListener('keydown',function(e){
    if(lb.hidden)return;
    if(e.key==='Escape'){closeLb()}
    else if(e.key==='ArrowLeft'){showLb(lbIdx-1)}
    else if(e.key==='ArrowRight'){showLb(lbIdx+1)}
    else if(e.key==='Tab'){
      var f=$$('.lb-btn',lb),first=f[0],last=f[f.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    }
  });
  var tx0=0;
  lb.addEventListener('touchstart',function(e){tx0=e.changedTouches[0].clientX},{passive:true});
  lb.addEventListener('touchend',function(e){
    var dx=e.changedTouches[0].clientX-tx0;
    if(Math.abs(dx)>50){showLb(lbIdx+(dx<0?1:-1))}
  },{passive:true});

  document.addEventListener('heart-tap',function(e){burst(e.detail.x,e.detail.y,70,Math.PI*2,-Math.PI/2,.8)});

  /* ---------- misc ---------- */
  $('#replay').addEventListener('click',party);
  function resize(){sizeFx();sizeBg();makeMotes();sizeSky();if(reduce)drawBg(0)}
  var rt;addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(resize,150)});
  sizeFx();sizeBg();makeMotes();sizeSky();requestAnimationFrame(drawBg);
  if(!reduce){setTimeout(party,1000)}
})();
