/* Initial-release presentation gates. Keep the underlying feature code and data intact. */
(function(root){
  'use strict';
  const flags=Object.freeze({randomMatch:false,ranked:false,pass:false,stamina:false});
  const enabled=name=>flags[name]===true;
  const api=Object.freeze({flags,enabled});
  root.NyanReleaseFeatures=api;
  if(root.document){
    for(const name of Object.keys(flags)){
      root.document.documentElement.classList.toggle(`feature-${name.toLowerCase()}-off`,!enabled(name));
    }
  }
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
