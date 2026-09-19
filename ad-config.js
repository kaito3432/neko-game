(function(root){
  'use strict';
  // Phase 5 ships only Google's official test inventory. Production builds must
  // inject a real rewarded ad unit ID here and set testing=false.
  root.NYAN_AD_CONFIG=Object.freeze({testing:true,rewardedAdUnitIds:Object.freeze({ios:'',android:''})});
})(typeof globalThis!=='undefined'?globalThis:this);
