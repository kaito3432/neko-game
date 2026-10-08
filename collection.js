/* にゃんチェイス - Phase 2 コレクション画面
   プレイヤーデータの表示と安全な装備・ホーム推し変更だけを担当する。
*/
(function(root,factory){
  const catalog=typeof module==="object" && module.exports
    ? require("./collection-catalog.js")
    : root?.NyanCollectionCatalog;
  const api=factory(root,catalog);

  if(typeof module==="object" && module.exports){
    module.exports=api;
  }

  if(root){
    root.NyanCollection=api;
  }
})(typeof globalThis!=="undefined" ? globalThis : this,(root,defaultCatalog)=>{
  "use strict";

  const SECTION_CATEGORIES=Object.freeze({
    cat:Object.freeze(["catSkin"]),
    police:Object.freeze(["dogSkin"]),
    town:Object.freeze(["cardboard","paw","boardTheme"]),
    rank:Object.freeze(["profileFrame"])
  });

  function isCharacterSkin(categoryId){
    return categoryId==="catSkin" || categoryId==="dogSkin";
  }

  function supportsProfilePreview(categoryId){
    return isCharacterSkin(categoryId) || categoryId==="profileFrame";
  }

  function boardThemePreviewModel(item,catalog=defaultCatalog){
    const theme=catalog.boardThemePresentation(item?.id);
    return {background:theme.background,cells:Array.from({length:25},(_,index)=>({
      number:index+1,blocked:index===0||index===24,
      object:index===0||index===24?theme.blockedObjects[index+1]:null
    }))};
  }

  function createBoardThemePreview(document,item,catalog=defaultCatalog){
    const model=boardThemePreviewModel(item,catalog);
    const preview=document.createElement("div");
    preview.className="collection-board-preview";
    preview.dataset.boardThemeId=item.id;
    preview.setAttribute("aria-hidden","true");
    preview.style.setProperty("--nyan-board-theme-image",`url("${model.background}")`);
    model.cells.forEach(cell=>{
      const tile=document.createElement("span");
      tile.className=cell.blocked?"preview-box is-blocked":"preview-box";
      tile.dataset.previewBox=String(cell.number);
      const row=Math.floor((cell.number-1)/5),col=(cell.number-1)%5;
      tile.style.left=`${5+col*19}%`;
      tile.style.top=`${5+row*19}%`;
      if(cell.blocked){
        const image=document.createElement("img");
        image.src=cell.object;
        image.alt="";
        image.draggable=false;
        tile.appendChild(image);
      }
      preview.appendChild(tile);
    });
    for(let row=0;row<4;row++)for(let col=0;col<4;col++){
      const node=document.createElement("span");
      node.className="preview-node";
      node.style.left=`${21+col*19}%`;
      node.style.top=`${21+row*19}%`;
      preview.appendChild(node);
    }
    return preview;
  }

  function createBoardThemePreviews(document,item,catalog=defaultCatalog){
    const model=boardThemePreviewModel(item,catalog);
    const previews=document.createElement("div");
    previews.className="collection-theme-previews";
    previews.dataset.boardThemeId=item.id;
    previews.setAttribute("aria-hidden","true");
    const home=document.createElement("div");
    home.className="collection-theme-preview-section";
    const homeLabel=document.createElement("span");
    homeLabel.className="collection-theme-preview-label";
    homeLabel.textContent="ホーム";
    const homeView=document.createElement("div");
    homeView.className="collection-home-preview";
    homeView.style.setProperty("--nyan-home-theme-image",`url("${model.background}")`);
    const logo=document.createElement("img");
    logo.src="./assets/images/home_logo.png";
    logo.alt="";
    logo.draggable=false;
    const hero=document.createElement("img");
    hero.className="collection-home-preview-hero";
    hero.src="./assets/images/home_hero.png";
    hero.alt="";
    hero.draggable=false;
    const modes=document.createElement("div");
    modes.className="collection-home-preview-modes";
    modes.textContent="対人戦　 CPU対戦　 オンライン対戦";
    homeView.append(logo,hero,modes);
    home.append(homeLabel,homeView);
    const play=document.createElement("div");
    play.className="collection-theme-preview-section";
    const playLabel=document.createElement("span");
    playLabel.className="collection-theme-preview-label";
    playLabel.textContent="プレイ画面";
    play.append(playLabel,createBoardThemePreview(document,item,catalog));
    previews.append(home,play);
    return previews;
  }

  function preserveOwnership(before,after,catalog=defaultCatalog){
    if(!before || !after || !catalog)return after;
    const ownership={};
    for(const category of Object.values(catalog.CATEGORIES)){
      if(category.ownedField && Array.isArray(before[category.ownedField])){
        ownership[category.ownedField]=[...before[category.ownedField]];
      }
    }
    return {...after,...ownership};
  }

  function presentedCollectionData(data,rankedProfile,selectors=root?.NyanKingQaSelectors){
    if(!data)return data;
    const source=rankedProfile?{
      ...data,
      ownedProfileFrames:rankedProfile.ownedProfileFrames,
      equippedProfileFrameId:rankedProfile.equippedProfileFrameId
    }:data;
    const hydrated={...source,
      ownedProfileFrames:[...new Set(['rank_bronze',...(source.ownedProfileFrames||[])])],
      equippedProfileFrameId:root?.NyanOnlineProfileUI?.frameId(source.equippedProfileFrameId)||'rank_bronze'};
    return root?.NyanBoardThemeQa?.presentationState?.(selectors?.collectionState?.(hydrated)||hydrated)
      || selectors?.collectionState?.(hydrated)||hydrated;
  }

  function getEquipLabel(categoryId,state){
    if(state==="unowned") return "🔒 未所持";
    if(isCharacterSkin(categoryId)){
      return state==="equipped" ? "スキン装備中" : "スキンを装備する";
    }
    return state==="equipped" ? "装備中" : "装備する";
  }

  function getItemState(data,item,catalog=defaultCatalog){
    const category=catalog?.getCategory(item?.category);
    if(!category || !data) return "unowned";

    const ownedItems=Array.isArray(data[category.ownedField])
      ? data[category.ownedField]
      : [];
    const isOwned=ownedItems.includes(item.id);
    const equippedId=category.equipmentScope==="onlineProfile"
      ? data[category.equippedField]
      : data.equippedAppearance?.[category.equippedField];
    const isEquipped=isOwned && equippedId===item.id;

    return isEquipped ? "equipped" : isOwned ? "owned" : "unowned";
  }

  function canEquipItem(data,item,catalog=defaultCatalog){
    const scope=catalog?.getCategory(item?.category)?.equipmentScope;
    return getItemState(data,item,catalog)==="owned"&&["appearance","onlineProfile"].includes(scope)&&
      item?.materialStatus!=="pending";
  }

  function displayImage(item,state,kind="collection"){
    if(item?.category==="profileFrame"){
      return (kind==="profile" ? item.profileImage : item.collectionImage) || item.frameImage || item.preview;
    }
    if(state==="unowned" && item?.acquisitionType!=="coins" && item?.acquisitionType!=="passMonthlyReward"){
      return (kind==="profile" ? item.lockedProfileImage : (item.lockedImage||item.silhouetteImage)) || "";
    }
    return (kind==="profile" ? item.profileImage : item.collectionImage) || item.preview;
  }

  function usesLockedImage(item,state){
    return item?.category!=="profileFrame" && state==="unowned" &&
      item?.acquisitionType!=="coins" && item?.acquisitionType!=="passMonthlyReward";
  }

  function isCollectionVisible(item,data=null,passSummary=null,catalog=defaultCatalog){
    if(item?.materialStatus==="pending" || item?.assetStatus==="placeholder")return false;
    if(item?.acquisitionType!=="passMonthlyReward")return true;
    if(data&&getItemState(data,item,catalog)!=="unowned")return true;
    return passSummary?.currentSkinAvailable===true&&passSummary.currentSkinId===item.id;
  }

  function sanitizeCatalogEquipment(data,catalog=defaultCatalog){
    if(!data || !catalog) return {data,changed:false};

    let changed=false;
    const equippedAppearance={...data.equippedAppearance};

    Object.values(catalog.CATEGORIES).forEach(category=>{
      // Only the five appearance categories live under equippedAppearance.
      // Rank rewards use the server profile and must not be repaired here.
      if(category.equipmentScope!=="appearance" || !category.equippedField || !Object.hasOwn(equippedAppearance,category.equippedField))return;
      const current=equippedAppearance[category.equippedField];
      const ownedItems=Array.isArray(data[category.ownedField])
        ? data[category.ownedField]
        : [];
      const valid=ownedItems.includes(current) &&
        catalog.isKnownItem(category.id,current);

      if(!valid && current!=="default"){
        equippedAppearance[category.equippedField]="default";
        changed=true;
      }
    });

    let favoriteCharacter=data.favoriteCharacter || null;
    if(favoriteCharacter){
      const favoriteCategory=catalog.getCategory(favoriteCharacter.category);
      const ownedItems=favoriteCategory && Array.isArray(data[favoriteCategory.ownedField])
        ? data[favoriteCategory.ownedField]
        : [];
      const valid=(favoriteCharacter.category==="catSkin" || favoriteCharacter.category==="dogSkin") &&
        ownedItems.includes(favoriteCharacter.itemId) &&
        Boolean(catalog.getItem(favoriteCharacter.category,favoriteCharacter.itemId)?.homeImage);
      if(!valid){
        favoriteCharacter=null;
        changed=true;
      }
    }

    let profileCharacter=data.profileCharacter || null;
    if(profileCharacter){
      const profileCategory=catalog.getCategory(profileCharacter.category);
      const ownedItems=profileCategory && Array.isArray(data[profileCategory.ownedField])
        ? data[profileCategory.ownedField]
        : [];
      const valid=isCharacterSkin(profileCharacter.category) &&
        ownedItems.includes(profileCharacter.itemId) &&
        Boolean(catalog.getItem(profileCharacter.category,profileCharacter.itemId)?.profileImage);
      if(!valid){
        profileCharacter=null;
        changed=true;
      }
    }

    return {
      data:changed ? {...data,equippedAppearance,favoriteCharacter,profileCharacter} : data,
      changed
    };
  }

  function validateEquip(data,categoryId,itemId,catalog=defaultCatalog){
    const category=catalog?.getCategory(categoryId);
    if(!category) return {ok:false,reason:"invalid_category"};

    const item=catalog.getItem(categoryId,itemId);
    if(!item || item.category!==categoryId){
      return {ok:false,reason:"unknown_item"};
    }

    const ownedItems=Array.isArray(data?.[category.ownedField])
      ? data[category.ownedField]
      : [];
    if(!ownedItems.includes(itemId)){
      return {ok:false,reason:"not_owned"};
    }
    if(item.materialStatus==="pending")return {ok:false,reason:"material_unavailable"};
    if(category.equipmentScope!=="appearance")return {ok:false,reason:"external_equipment"};

    return {ok:true,category,item};
  }

  function validatePurchase(data,categoryId,itemId,catalog=defaultCatalog){
    const category=catalog?.getCategory(categoryId),item=catalog?.getItem(categoryId,itemId);
    if(!category||!item)return {ok:false,reason:"unknown_item"};
    if(item.acquisitionType!=="coins"||item.currency!=="nyanCoins"||!Number.isSafeInteger(item.priceCoins))return {ok:false,reason:"not_coin_purchasable"};
    if(item.materialStatus!=="ready"||item.assetStatus!=="ready")return {ok:false,reason:"material_unavailable",category,item};
    if(data?.[category.ownedField]?.includes(itemId))return {ok:false,reason:"already_owned",category,item};
    if((Number(data?.nyanCoins)||0)<item.priceCoins)return {ok:false,reason:"insufficient_coins",category,item};
    return {ok:true,category,item};
  }

  function purchaseConfirmation(data,categoryId,itemId,catalog=defaultCatalog){
    const validation=validatePurchase(data,categoryId,itemId,catalog);
    if(!validation.ok)return validation;
    const current=Number(data?.nyanCoins)||0;
    return {ok:true,category:validation.category,item:validation.item,current,
      price:validation.item.priceCoins,after:current-validation.item.priceCoins};
  }

  function validateFavorite(data,categoryId,itemId,catalog=defaultCatalog){
    if(categoryId!=="catSkin" && categoryId!=="dogSkin"){
      return {ok:false,reason:"invalid_category"};
    }
    const validation=validateEquip(data,categoryId,itemId,catalog);
    if(!validation.ok) return validation;
    if(!validation.item.homeImage || validation.item.id==="default"){
      return {ok:false,reason:"home_image_unavailable"};
    }
    return validation;
  }

  function validateProfile(data,categoryId,itemId,catalog=defaultCatalog){
    if(!isCharacterSkin(categoryId)){
      return {ok:false,reason:"invalid_category"};
    }
    const validation=validateEquip(data,categoryId,itemId,catalog);
    if(!validation.ok) return validation;
    if(!validation.item.profileImage){
      return {ok:false,reason:"profile_image_unavailable"};
    }
    return validation;
  }

  function createController({playerData,catalog=defaultCatalog,view={}}={}){
    let currentData=null;
    let activeSection="cat";
    let selectedItem=null;
    let saving=false;

    function render(){
      view.render?.({data:currentData,activeSection,selectedItem,saving});
    }

    async function load(){
      try{
        const loaded=await playerData.load();
        const repaired=sanitizeCatalogEquipment(loaded,catalog);
        currentData=repaired.changed
          ? await playerData.save(repaired.data)
          : loaded;
        render();
        return currentData;
      }catch(error){
        currentData=playerData.getSnapshot?.() || currentData;
        view.showError?.("コレクションを読み込めませんでした");
        render();
        return currentData;
      }
    }

    function setSection(section){
      if(!SECTION_CATEGORIES[section]) return false;
      activeSection=section;
      render();
      return true;
    }

    function selectItem(categoryId,itemId){
      if(!catalog.getItem(categoryId,itemId)) return false;
      selectedItem={categoryId,itemId};
      render();
      return true;
    }

    function closeDetail(){
      selectedItem=null;
      render();
    }

    async function equip(categoryId,itemId){
      if(saving) return {ok:false,reason:"busy",data:currentData};

      const validation=validateEquip(currentData,categoryId,itemId,catalog);
      if(!validation.ok) return {...validation,data:currentData};

      if(currentData.equippedAppearance?.[validation.category.equippedField]===itemId){
        return {ok:true,reason:"already_equipped",data:currentData};
      }

      saving=true;
      view.setBusy?.(true);
      render();

      try{
        const saved=await playerData.updateEquipment(categoryId,itemId);
        currentData=sanitizeCatalogEquipment(saved,catalog).data;
        root?.dispatchEvent?.(new root.CustomEvent("nyan-player-appearance-changed"));
        render();
        return {ok:true,data:currentData};
      }catch(error){
        currentData=playerData.getSnapshot?.() || currentData;
        view.showError?.("装備を保存できませんでした");
        render();
        return {ok:false,reason:"save_failed",data:currentData,error};
      }finally{
        saving=false;
        view.setBusy?.(false);
        render();
      }
    }

    async function purchase(categoryId,itemId){
      if(saving)return {ok:false,reason:"busy",data:currentData};
      const validation=validatePurchase(currentData,categoryId,itemId,catalog);
      if(!validation.ok){
        if(validation.reason==="insufficient_coins")view.showError?.("にゃんコインが足りません");
        return {...validation,data:currentData};
      }
      saving=true;view.setBusy?.(true);render();
      try{
        const saved=await playerData.purchaseCollectionItem(categoryId,itemId);
        currentData=sanitizeCatalogEquipment(saved,catalog).data;
        root?.dispatchEvent?.(new root.CustomEvent("nyan-player-progress-changed"));
        render();return {ok:true,data:currentData};
      }catch(error){
        currentData=playerData.getSnapshot?.()||currentData;
        view.showError?.(error?.message==="insufficient_coins"?"にゃんコインが足りません":"購入を完了できませんでした");
        render();return {ok:false,reason:error?.message||"purchase_failed",data:currentData,error};
      }finally{saving=false;view.setBusy?.(false);render();}
    }

    async function setFavorite(categoryId,itemId){
      if(saving) return {ok:false,reason:"busy",data:currentData};
      const isCurrent=currentData.favoriteCharacter?.category===categoryId &&
        currentData.favoriteCharacter?.itemId===itemId;
      if(!isCurrent){
        const validation=validateFavorite(currentData,categoryId,itemId,catalog);
        if(!validation.ok) return {...validation,data:currentData};
      }
      const nextItemId=isCurrent ? null : itemId;

      saving=true;
      view.setBusy?.(true);
      render();
      try{
        const before=currentData;
        const saved=await playerData.updateFavoriteCharacter(categoryId,nextItemId);
        currentData=sanitizeCatalogEquipment(preserveOwnership(before,saved,catalog),catalog).data;
        root?.dispatchEvent?.(new root.CustomEvent("nyan-player-appearance-changed"));
        render();
        return {ok:true,data:currentData};
      }catch(error){
        currentData=playerData.getSnapshot?.() || currentData;
        view.showError?.("ホーム推しキャラを保存できませんでした");
        render();
        return {ok:false,reason:"save_failed",data:currentData,error};
      }finally{
        saving=false;
        view.setBusy?.(false);
        render();
      }
    }

    async function setProfile(categoryId,itemId){
      if(saving) return {ok:false,reason:"busy",data:currentData};
      const isCurrent=currentData.profileCharacter?.category===categoryId &&
        currentData.profileCharacter?.itemId===itemId;
      if(!isCurrent){
        const validation=validateProfile(currentData,categoryId,itemId,catalog);
        if(!validation.ok) return {...validation,data:currentData};
      }
      const nextItemId=isCurrent ? null : itemId;

      saving=true;
      view.setBusy?.(true);
      render();
      try{
        const before=currentData;
        const saved=await playerData.updateProfileCharacter(categoryId,nextItemId);
        currentData=sanitizeCatalogEquipment(preserveOwnership(before,saved,catalog),catalog).data;
        root?.dispatchEvent?.(new root.CustomEvent("nyan-player-appearance-changed"));
        render();
        return {ok:true,data:currentData};
      }catch(error){
        currentData=playerData.getSnapshot?.() || currentData;
        view.showError?.("プロフィール設定を保存できませんでした");
        render();
        return {ok:false,reason:"save_failed",data:currentData,error};
      }finally{
        saving=false;
        view.setBusy?.(false);
        render();
      }
    }

    function getState(){
      return {data:currentData,activeSection,selectedItem,saving};
    }

    return {load,setSection,selectItem,closeDetail,equip,purchase,setFavorite,setProfile,getState};
  }

  function createDomView(document,catalog,actions){
    const balance=document.getElementById("collectionCoinBalance");
    const content=document.getElementById("collectionContent");
    const status=document.getElementById("collectionStatus");
    const tabs=[...document.querySelectorAll("[data-collection-section]")];
    const detail=document.getElementById("collectionDetail");
    const purchaseConfirm=document.getElementById("collectionPurchaseConfirm");
    const purchaseConfirmName=purchaseConfirm?.querySelector("[data-purchase-confirm-name]");
    const purchaseConfirmPrice=purchaseConfirm?.querySelector("[data-purchase-confirm-price]");
    const purchaseConfirmCurrent=purchaseConfirm?.querySelector("[data-purchase-confirm-current]");
    const purchaseConfirmAfter=purchaseConfirm?.querySelector("[data-purchase-confirm-after]");
    const purchaseConfirmCancel=purchaseConfirm?.querySelector("[data-purchase-confirm-cancel]");
    const purchaseConfirmSubmit=purchaseConfirm?.querySelector("[data-purchase-confirm-submit]");
    let pendingPurchase=null;

    function setText(element,text){
      if(element) element.textContent=text;
    }

    function closePurchaseConfirm(){
      pendingPurchase=null;
      purchaseConfirm?.classList.remove("show");
      purchaseConfirm?.setAttribute("aria-hidden","true");
      if(purchaseConfirmSubmit)purchaseConfirmSubmit.disabled=false;
    }

    function requestPurchase(item,data,saving){
      const validation=purchaseConfirmation(data,item.category,item.id,catalog);
      if(!validation.ok||saving){
        if(validation.reason==="insufficient_coins")showError("にゃんコインが足りません");
        return false;
      }
      pendingPurchase={categoryId:item.category,itemId:item.id};
      setText(purchaseConfirmName,`${item.name}を購入しますか？`);
      setText(purchaseConfirmPrice,`🪙 ${validation.price}`);
      setText(purchaseConfirmCurrent,`🪙 ${validation.current}`);
      setText(purchaseConfirmAfter,`🪙 ${validation.after}`);
      purchaseConfirm?.classList.add("show");
      purchaseConfirm?.setAttribute("aria-hidden","false");
      purchaseConfirmSubmit?.focus();
      return true;
    }

    purchaseConfirmCancel?.addEventListener("click",closePurchaseConfirm);
    purchaseConfirm?.addEventListener("click",event=>{if(event.target===purchaseConfirm)closePurchaseConfirm();});
    purchaseConfirmSubmit?.addEventListener("click",async()=>{
      if(!pendingPurchase||purchaseConfirmSubmit.disabled)return;
      const target={...pendingPurchase};
      purchaseConfirmSubmit.disabled=true;
      const result=await actions.onPurchase(target.categoryId,target.itemId);
      if(result?.ok)closePurchaseConfirm();
      else purchaseConfirmSubmit.disabled=false;
    });

    function createItemCard(item,data,saving){
      const category=catalog.getCategory(item.category);
      const state=getItemState(data,item,catalog);
      const card=document.createElement("article");
      card.className=`collection-item is-${state}`;

      const preview=document.createElement("button");
      preview.type="button";
      preview.className="collection-item-preview";
      preview.setAttribute("aria-label",`${item.name}の詳細を見る`);
      const image=document.createElement("img");
      const silhouetteSource=usesLockedImage(item,state);
      const source=displayImage(item,state);
      if(source) image.src=source;
      image.onerror=()=>image.removeAttribute("src");
      image.alt=`${category.label} ${item.name}`;
      image.decoding="async";
      image.dataset.itemId=item.id;
      image.classList.toggle("uses-silhouette-source",silhouetteSource);
      const detailBadge=document.createElement("span");
      detailBadge.className="collection-preview-badge";
      detailBadge.setAttribute("aria-hidden","true");
      detailBadge.textContent="🔍 詳細を見る";
      if(item.category==="boardTheme")preview.append(createBoardThemePreviews(document,item,catalog),detailBadge);
      else preview.append(image,detailBadge);

      if(state==="unowned" && item.acquisitionType==="coins"){
        const priceBadge=document.createElement("span");
        priceBadge.className="collection-price-badge";
        priceBadge.textContent=`🪙 ×${item.priceCoins}`;
        preview.appendChild(priceBadge);
      }

      const copy=document.createElement("div");
      copy.className="collection-item-copy";
      const name=document.createElement("strong");
      name.textContent=item.name;
      const badge=document.createElement("span");
      badge.className="collection-state";
      badge.textContent=item.acquisitionType==="passMonthlyReward"
        ?`Pass限定・${state==="equipped"?"装備中":state==="owned"?"獲得済み":"未獲得"}`
        :state==="equipped" ? "装備中" : state==="owned" ? "所持" : "未所持";
      copy.append(name,badge);

      const button=document.createElement("button");
      button.type="button";
      button.className="collection-equip-btn";
      const coinItem=item.acquisitionType==="coins";
      const purchaseValidation=coinItem&&state==="unowned"?validatePurchase(data,item.category,item.id,catalog):null;
      const purchasable=purchaseValidation?.ok===true;
      button.classList.toggle("is-purchasable",purchasable);
      button.textContent=state==="unowned"&&coinItem?`🪙 ${item.priceCoins}で購入`:getEquipLabel(item.category,state);
      if(state==="unowned"&&!coinItem)button.textContent=catalog.acquisitionLabel(item);
      if(coinItem&&(item.materialStatus!=="ready"||item.assetStatus!=="ready"))button.textContent="素材未設定";
      button.disabled=saving || (state==="unowned" ? !purchasable : !canEquipItem(data,item,catalog));
      button.addEventListener("click",event=>{
        event.stopPropagation();
        if(state==="unowned")requestPurchase(item,data,saving);
        else actions.onEquip(item.category,item.id);
      });

      const open=()=>actions.onSelect(item.category,item.id);
      preview.addEventListener("click",open);

      card.append(preview,copy,button);
      return card;
    }

    function renderDetail(data,selectedItem,saving,passSummary){
      if(!detail) return;
      if(!selectedItem){
        detail.classList.remove("show");
        detail.setAttribute("aria-hidden","true");
        detail.querySelectorAll("img").forEach(image=>{image.onerror=null;image.removeAttribute("src");});
        return;
      }
      const item=catalog.getItem(selectedItem.categoryId,selectedItem.itemId);
      if(!item || !isCollectionVisible(item,data,passSummary,catalog)){
        detail.classList.remove("show");
        detail.setAttribute("aria-hidden","true");
        return;
      }
      const state=getItemState(data,item,catalog);
      const collectionImage=detail.querySelector("[data-detail-collection-image]");
      const boardPreview=detail.querySelector("[data-detail-board-preview]");
      const materialPending=detail.querySelector("[data-detail-material]");
      const profileImage=detail.querySelector("[data-detail-profile-image]");
      const profilePreview=detail.querySelector("[data-detail-profile-preview]");
      const showProfilePreview=supportsProfilePreview(item.category);
      if(profilePreview)profilePreview.hidden=!showProfilePreview;
      const names=[...detail.querySelectorAll("[data-detail-name]")];
      const stateLabel=detail.querySelector("[data-detail-state]");
      const equipButton=detail.querySelector("[data-detail-equip]");
      const favoriteButton=detail.querySelector("[data-detail-favorite]");
      const profileButton=detail.querySelector("[data-detail-profile]");
      const usageGuide=detail.querySelector("[data-detail-usage]");
      const usageBoard=detail.querySelector("[data-detail-usage-board]");
      const usageHome=detail.querySelector("[data-detail-usage-home]");
      const usageProfile=detail.querySelector("[data-detail-usage-profile]");
      const unlock=detail.querySelector("[data-detail-unlock]");
      const categoryLabel=detail.querySelector("[data-detail-category]");
      const acquisition=detail.querySelector("[data-detail-acquisition]");
      const price=detail.querySelector("[data-detail-price]");
      const localNote=detail.querySelector("[data-detail-local-note]");
      const purchaseButton=detail.querySelector("[data-detail-purchase]");
      if(materialPending)materialPending.hidden=item.materialStatus!=="pending";
      if(unlock){
        unlock.hidden=!item.unlockCondition;
        if(item.unlockCondition){
          setText(unlock.querySelector("[data-unlock-description]"),item.unlockCondition.text);
          setText(unlock.querySelector("[data-unlock-progress]"),`${data.skinUnlockProgress?.[item.unlockCondition.progressKey] || 0} / ${item.unlockCondition.target}`);
        }
      }
      const isFavorite=data.favoriteCharacter?.category===item.category &&
        data.favoriteCharacter?.itemId===item.id;
      const isProfile=data.profileCharacter?.category===item.category &&
        data.profileCharacter?.itemId===item.id;

      detail.classList.toggle("is-unowned",state==="unowned");
      detail.dataset.category=item.category;
      detail.dataset.itemId=item.id;
      if(collectionImage){
        collectionImage.hidden=item.category==="boardTheme";
        const silhouetteSource=usesLockedImage(item,state);
        collectionImage.onerror=()=>{
          collectionImage.onerror=null;
          if(silhouetteSource) collectionImage.removeAttribute("src");
          else collectionImage.src=item.preview;
        };
        const source=displayImage(item,state);
        if(source) collectionImage.src=source;
        else collectionImage.removeAttribute("src");
        collectionImage.alt=item.name;
        collectionImage.dataset.itemId=item.id;
        collectionImage.classList.toggle("uses-silhouette-source",silhouetteSource);
      }
      if(boardPreview){
        boardPreview.hidden=item.category!=="boardTheme";
        boardPreview.replaceChildren();
        if(item.category==="boardTheme")boardPreview.appendChild(createBoardThemePreviews(document,item,catalog));
      }
      if(profileImage && showProfilePreview){
        profileImage.onerror=()=>{
          profileImage.onerror=null;
          if(usesLockedImage(item,state)) profileImage.removeAttribute("src");
          else profileImage.src=item.preview;
        };
        const source=displayImage(item,state,"profile");
        if(source) profileImage.src=source;
        else profileImage.removeAttribute("src");
        profileImage.alt=`${item.name} プロフィール画像`;
      }else if(profileImage){
        profileImage.onerror=null;
        profileImage.removeAttribute("src");
      }
      names.forEach(name=>setText(name,item.name));
      setText(categoryLabel,catalog.getCategory(item.category)?.label||item.category);
      setText(acquisition,catalog.acquisitionLabel(item));
      setText(price,item.acquisitionType==="coins"?`🪙 ×${item.priceCoins}`:"—");
      if(localNote)localNote.hidden=!catalog.isLocalOnly(item.category);
      setText(stateLabel,item.acquisitionType==="passMonthlyReward"
        ?`Pass限定・${state==="equipped"?"装備中":state==="owned"?"獲得済み":"未獲得"}`
        :state==="equipped" ? "装備中" : state==="owned" ? "所持" : "🔒 未所持");
      if(purchaseButton){
        const purchaseValidation=validatePurchase(data,item.category,item.id,catalog);
        purchaseButton.hidden=item.acquisitionType!=="coins"||state!=="unowned";
        purchaseButton.textContent=item.materialStatus!=="ready"||item.assetStatus!=="ready"?"素材未設定":`🪙 ${item.priceCoins}で購入`;
        purchaseButton.disabled=saving||!purchaseValidation.ok;
        purchaseButton.classList.toggle("is-purchasable",purchaseValidation.ok);
        purchaseButton.onclick=()=>requestPurchase(item,data,saving);
      }
      if(equipButton){
        equipButton.textContent=getEquipLabel(item.category,state);
        equipButton.hidden=!["appearance","onlineProfile"].includes(catalog.getCategory(item.category)?.equipmentScope);
        equipButton.disabled=saving || !canEquipItem(data,item,catalog);
        equipButton.onclick=()=>actions.onEquip(item.category,item.id);
      }
      if(favoriteButton){
        const characterSkin=isCharacterSkin(item.category);
        const canFavorite=characterSkin &&
          state!=="unowned" && item.id!=="default" && Boolean(item.homeImage);
        favoriteButton.hidden=!characterSkin;
        favoriteButton.classList.toggle("is-reset",canFavorite && isFavorite);
        favoriteButton.textContent=state==="unowned"
          ? "🔒 未所持"
          : item.id==="default"
            ? "ホーム表示対象外"
            : isFavorite ? "ホームをデフォルトに戻す" : "ホームに表示";
        favoriteButton.disabled=saving || !canFavorite;
        favoriteButton.onclick=()=>actions.onFavorite(item.category,item.id);
      }
      if(profileButton){
        const characterSkin=isCharacterSkin(item.category);
        const canProfile=characterSkin && state!=="unowned" && item.id!=="default" && Boolean(item.profileImage);
        profileButton.hidden=!characterSkin;
        profileButton.classList.toggle("is-reset",canProfile && isProfile);
        profileButton.textContent=state==="unowned"
          ? "🔒 未所持"
          : item.id==="default" ? "デフォルト使用中"
            : isProfile ? "プロフィールをデフォルトに戻す" : "プロフィールに設定";
        profileButton.disabled=saving || !canProfile;
        profileButton.onclick=()=>actions.onProfile(item.category,item.id);
      }
      if(usageGuide){
        usageGuide.hidden=!isCharacterSkin(item.category);
      }
      if(usageBoard){
        usageBoard.classList.toggle("is-active",state==="equipped");
        usageBoard.classList.remove("is-reset","is-unavailable");
        usageBoard.disabled=saving || state!=="owned";
        usageBoard.onclick=state==="owned" ? ()=>actions.onEquip(item.category,item.id) : null;
        setText(usageBoard.querySelector("small"),state==="equipped"
          ? "現在この駒を使用中"
          : state==="unowned" ? "所持すると利用できます" : "装備すると自動で適用");
      }
      if(usageHome){
        usageHome.classList.toggle("is-active",isFavorite);
        const canUseHome=state!=="unowned" && item.id!=="default" && Boolean(item.homeImage);
        usageHome.classList.toggle("is-reset",canUseHome && isFavorite);
        usageHome.classList.toggle("is-unavailable",!canUseHome);
        usageHome.disabled=saving || !canUseHome;
        usageHome.onclick=canUseHome ? ()=>actions.onFavorite(item.category,item.id) : null;
        setText(usageHome.querySelector("strong"),item.id==="default" ? "ホーム表示対象外" : "ホームに表示");
        setText(usageHome.querySelector("small"),isFavorite
          ? "タップでデフォルトに戻す"
          : state==="unowned" ? "所持すると利用できます" : item.id==="default"
            ? "追加スキンで利用できます" : "タップしてホームに表示");
      }
      if(usageProfile){
        usageProfile.classList.toggle("is-active",isProfile);
        const canUseProfile=state!=="unowned" && item.id!=="default" && Boolean(item.profileImage);
        usageProfile.classList.toggle("is-reset",canUseProfile && isProfile);
        usageProfile.classList.toggle("is-unavailable",!canUseProfile);
        usageProfile.disabled=saving || !canUseProfile;
        usageProfile.onclick=canUseProfile ? ()=>actions.onProfile(item.category,item.id) : null;
        setText(usageProfile.querySelector("small"),isProfile
          ? "タップでデフォルトに戻す"
          : state==="unowned" ? "所持すると利用できます" : item.id==="default"
            ? "デフォルト画像を使用中" : "タップしてプロフィールに設定");
      }
      detail.classList.add("show");
      detail.setAttribute("aria-hidden","false");
    }

    let currentPassSummary=null;
    function setPassSummary(summary){currentPassSummary=summary||null;}

    function render({data,activeSection,selectedItem,saving}){
      if(!data || !content) return;
      const rankedProfile=root?.NyanRankedUI?.getProfile?.();
      const presentedData=presentedCollectionData(data,rankedProfile);
      const renderedBalance=root?.NyanKingQaSelectors?.coinBalance?.(presentedData)
        ?? window.NyanRankedUI?.totalCoins(data.nyanCoins) ?? data.nyanCoins;
      setText(balance,String(renderedBalance));

      tabs.forEach(tab=>{
        const selected=tab.dataset.collectionSection===activeSection;
        tab.classList.toggle("selected",selected);
        tab.setAttribute("aria-selected",selected ? "true" : "false");
      });

      content.innerHTML="";
      SECTION_CATEGORIES[activeSection].forEach(categoryId=>{
        const category=catalog.getCategory(categoryId);
        const group=document.createElement("section");
        group.className="collection-group";
        const heading=document.createElement("h2");
        heading.textContent=category.label;
        group.append(heading);
        const available=catalog.getItemsByCategory(categoryId)
          .filter(item=>isCollectionVisible(item,presentedData,currentPassSummary,catalog));
        for(const [bucket,label] of [["owned","所持済み"],["unowned","未所持"]]){
          const items=available.filter(item=>(getItemState(presentedData,item,catalog)==="unowned")
            ===(bucket==="unowned"));
          const section=document.createElement("section");section.className="collection-ownership-group";
          const title=document.createElement("h3");title.textContent=`${label} ${items.length}`;
          const grid=document.createElement("div");grid.className="collection-grid";
          items.forEach(item=>grid.appendChild(createItemCard(item,presentedData,saving)));
          if(!items.length){const empty=document.createElement("p");empty.className="collection-empty";
            empty.textContent=bucket==="owned"?"まだありません":"現在表示できるアイテムはありません";section.append(title,empty);}
          else section.append(title,grid);
          group.append(section);
        }
        content.appendChild(group);
      });
      renderDetail(presentedData,selectedItem,saving,currentPassSummary);
    }

    function setBusy(isBusy){
      document.getElementById("collectionOverlay")?.classList.toggle("is-saving",isBusy);
    }

    function showError(message){
      setText(status,message);
      status?.classList.add("show");
      root?.setTimeout?.(()=>status?.classList.remove("show"),2600);
    }

    return {render,setBusy,showError,closePurchaseConfirm,setPassSummary};
  }

  function initializeBrowser(){
    const document=root?.document;
    const playerData=root?.NyanPlayerData;
    const catalog=root?.NyanCollectionCatalog;
    if(!document || !playerData || !catalog) return null;

    const overlay=document.getElementById("collectionOverlay");
    const openButton=document.getElementById("collectionOpenBtn");
    const backButton=document.getElementById("collectionBackBtn");
    if(!overlay || !openButton || !backButton) return null;

    let controller=null;
    const view=createDomView(document,catalog,{
      async onEquip(categoryId,itemId){
        if(catalog.getCategory(categoryId)?.equipmentScope==="onlineProfile"){
          if(root.NyanBoardThemeQa?.active){root.NyanBoardThemeQa.equipFrame(itemId);return controller?.load();}
          await root.NyanRankedUI?.equipFrame?.(itemId);
          return controller?.load();
        }
        return controller?.equip(categoryId,itemId);
      },
      onPurchase(categoryId,itemId){return controller?.purchase(categoryId,itemId);},
      onSelect(categoryId,itemId){controller?.selectItem(categoryId,itemId);},
      onFavorite(categoryId,itemId){controller?.setFavorite(categoryId,itemId);},
      onProfile(categoryId,itemId){controller?.setProfile(categoryId,itemId);}
    });
    controller=createController({playerData:root.NyanBoardThemeQa?.collectionPlayerData||playerData,catalog,view});
    root.addEventListener("nyan-online-profile",event=>{
      if(!overlay.classList.contains("show"))return;
      view.setPassSummary(event.detail?.passSummary);
      controller.load();
    });
    root.addEventListener("nyan-player-progress-changed",()=>{
      if(overlay.classList.contains("show") && !controller.getState().saving) controller.load();
    });

    openButton.addEventListener("click",async()=>{
      overlay.classList.add("show");
      overlay.setAttribute("aria-hidden","false");
      view.setPassSummary(null);
      await controller.load();
      try{
        const base=root.NyanOnline?.API_BASE;
        if(base&&root.NyanOnlineIdentity){
          await root.NyanOnlineIdentity.prepare(base);
          await root.NyanOnlineIdentity.refreshSkillView(base);
        }
      }catch(_){/* Offline Collection stays usable; an unverified monthly preview stays hidden. */}
    });

    backButton.addEventListener("click",()=>{
      if(document.getElementById("collectionPurchaseConfirm")?.classList.contains("show")){
        view.closePurchaseConfirm();
        return;
      }
      if(controller.getState().selectedItem){
        controller.closeDetail();
        return;
      }
      overlay.classList.remove("show");
      overlay.setAttribute("aria-hidden","true");
      openButton.focus();
    });

    document.getElementById("collectionDetailBackBtn")?.addEventListener("click",()=>{
      controller.closeDetail();
    });

    document.querySelectorAll("[data-collection-section]").forEach(tab=>{
      tab.addEventListener("click",()=>controller.setSection(tab.dataset.collectionSection));
    });

    return controller;
  }

  const api=Object.freeze({
    SECTION_CATEGORIES,
    isCharacterSkin,
    supportsProfilePreview,
    boardThemePreviewModel,
    createBoardThemePreview,
    createBoardThemePreviews,
    preserveOwnership,
    presentedCollectionData,
    getEquipLabel,
    getItemState,
    canEquipItem,
    displayImage,
    usesLockedImage,
    isCollectionVisible,
    sanitizeCatalogEquipment,
    validateEquip,
    validatePurchase,
    purchaseConfirmation,
    validateFavorite,
    validateProfile,
    createController,
    initializeBrowser
  });

  if(root?.document){
    initializeBrowser();
  }

  return api;
});
