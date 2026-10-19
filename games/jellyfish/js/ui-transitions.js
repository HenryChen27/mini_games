const UITransitions=(()=>{
  const states=new WeakMap();
  function show(element,open) {
    const previous=states.get(element);
    if(previous?.open===open)return;
    previous?.animation?.cancel();
    const state={open};states.set(element,state);
    if(open)element.hidden=false;
    else if(element.hidden)return;
    element.style.pointerEvents=open?'':'none';
    const from=previous?Number(getComputedStyle(element).opacity):(open?0:1);
    state.animation=element.animate([{opacity:from},{opacity:open?1:0}],{duration:200,easing:'ease-out',fill:'forwards'});
    state.animation.onfinish=()=>{if(states.get(element)!==state)return;element.hidden=!open;state.animation.cancel();};
  }
  function closeDialog(dialog) {
    if(!dialog.open || dialog.dataset.closing)return;
    dialog.dataset.closing='true';
    dialog.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(12px)'}],{duration:180,easing:'ease-in'}).onfinish=()=>{
      dialog.close();delete dialog.dataset.closing;
    };
  }
  function install() {
    const disable=root=>root.querySelectorAll('button').forEach(button=>button.tabIndex=-1);
    disable(document);
    new MutationObserver(()=>disable(document)).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('pointerdown',e=>{if(e.target.closest('button'))e.preventDefault();},true);
    document.addEventListener('focusin',e=>{if(e.target.matches('button'))e.target.blur();},true);
    document.addEventListener('keydown',e=>{if(e.target.closest('button')){e.preventDefault();e.stopImmediatePropagation();}},true);
  }
  return {show,closeDialog,install};
})();
