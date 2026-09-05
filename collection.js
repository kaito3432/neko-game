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
    town:Object.freeze(["cardboard","paw","boardTheme"])
  });

  function isCharacterSkin(categoryId){
    return categoryId==="catSkin" || categoryId==="dogSkin";
  }

  function getEquipLabel(categoryId,state){
    if(state==="unowned") return "🔒 未所持";
    if(isCharacterSkin(categoryId)){
      return state==="equipped" ? "盤面に適用中" : "盤面の駒に適用";
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
    const isEquipped=isOwned &&
      data.equippedAppearance?.[category.equippedField]===item.id;

    return isEquipped ? "equipped" : isOwned ? "owned" : "unowned";
  }

  function sanitizeCatalogEquipment(data,catalog=defaultCatalog){
    if(!data || !catalog) return {data,changed:false};

    let changed=false;
    const equippedAppearance={...data.equippedAppearance};

    Object.values(catalog.CATEGORIES).forEach(category=>{
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
      const valid=(profileCharacter.category==="catSkin" || profileCharacter.category==="dogSkin") &&
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

    return {ok:true,category,item};
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
    if(categoryId!=="catSkin" && categoryId!=="dogSkin"){
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

    async function setFavorite(categoryId,itemId){
      if(saving) return {ok:false,reason:"busy",data:currentData};
      const validation=validateFavorite(currentData,categoryId,itemId,catalog);
      if(!validation.ok) return {...validation,data:currentData};
      if(currentData.favoriteCharacter?.category===categoryId &&
        currentData.favoriteCharacter?.itemId===itemId){
        return {ok:true,reason:"already_favorite",data:currentData};
      }

      saving=true;
      view.setBusy?.(true);
      render();
      try{
        const saved=await playerData.updateFavoriteCharacter(categoryId,itemId);
        currentData=sanitizeCatalogEquipment(saved,catalog).data;
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
      const validation=validateProfile(currentData,categoryId,itemId,catalog);
      if(!validation.ok) return {...validation,data:currentData};
      if(currentData.profileCharacter?.category===categoryId &&
        currentData.profileCharacter?.itemId===itemId){
        return {ok:true,reason:"already_profile",data:currentData};
      }

      saving=true;
      view.setBusy?.(true);
      render();
      try{
        const saved=await playerData.updateProfileCharacter(categoryId,itemId);
        currentData=sanitizeCatalogEquipment(saved,catalog).data;
        root?.dispatchEvent?.(new root.CustomEvent("nyan-player-appearance-changed"));
        render();
        return {ok:true,data:currentData};
      }catch(error){
        currentData=playerData.getSnapshot?.() || currentData;
        view.showError?.("プロフィール画像を保存できませんでした");
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

    return {load,setSection,selectItem,closeDetail,equip,setFavorite,setProfile,getState};
  }

  function createDomView(document,catalog,actions){
    const balance=document.getElementById("collectionCoinBalance");
    const content=document.getElementById("collectionContent");
    const status=document.getElementById("collectionStatus");
    const tabs=[...document.querySelectorAll("[data-collection-section]")];
    const detail=document.getElementById("collectionDetail");

    function setText(element,text){
      if(element) element.textContent=text;
    }

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
      image.src=state==="unowned" && isCharacterSkin(item.category)
        ? (item.profileImage || item.preview)
        : item.preview;
      image.alt=`${category.label} ${item.name}`;
      image.decoding="async";
      const detailBadge=document.createElement("span");
      detailBadge.className="collection-preview-badge";
      detailBadge.setAttribute("aria-hidden","true");
      detailBadge.textContent="🔍 詳細を見る";
      preview.append(image,detailBadge);

      if(state==="unowned"){
        const unownedCover=document.createElement("span");
        unownedCover.className="collection-unowned-cover";
        unownedCover.setAttribute("aria-hidden","true");
        const question=document.createElement("strong");
        question.textContent="?";
        const unownedLabel=document.createElement("small");
        unownedLabel.textContent="🔒 未所持";
        unownedCover.append(question,unownedLabel);
        preview.appendChild(unownedCover);
      }

      const copy=document.createElement("div");
      copy.className="collection-item-copy";
      const name=document.createElement("strong");
      name.textContent=item.name;
      const badge=document.createElement("span");
      badge.className="collection-state";
      badge.textContent=state==="equipped" ? "装備中" : state==="owned" ? "所持" : "未所持";
      copy.append(name,badge);

      const button=document.createElement("button");
      button.type="button";
      button.className="collection-equip-btn";
      button.textContent=getEquipLabel(item.category,state);
      button.disabled=saving || state!=="owned";
      button.addEventListener("click",event=>{
        event.stopPropagation();
        actions.onEquip(item.category,item.id);
      });

      const open=()=>actions.onSelect(item.category,item.id);
      preview.addEventListener("click",open);

      card.append(preview,copy,button);
      return card;
    }

    function renderDetail(data,selectedItem,saving){
      if(!detail) return;
      if(!selectedItem){
        detail.classList.remove("show");
        detail.setAttribute("aria-hidden","true");
        return;
      }
      const item=catalog.getItem(selectedItem.categoryId,selectedItem.itemId);
      if(!item) return;
      const state=getItemState(data,item,catalog);
      const collectionImage=detail.querySelector("[data-detail-collection-image]");
      const profileImage=detail.querySelector("[data-detail-profile-image]");
      const names=[...detail.querySelectorAll("[data-detail-name]")];
      const stateLabel=detail.querySelector("[data-detail-state]");
      const equipButton=detail.querySelector("[data-detail-equip]");
      const favoriteButton=detail.querySelector("[data-detail-favorite]");
      const profileButton=detail.querySelector("[data-detail-profile]");
      const usageGuide=detail.querySelector("[data-detail-usage]");
      const usageBoard=detail.querySelector("[data-detail-usage-board]");
      const usageHome=detail.querySelector("[data-detail-usage-home]");
      const usageProfile=detail.querySelector("[data-detail-usage-profile]");
      const isFavorite=data.favoriteCharacter?.category===item.category &&
        data.favoriteCharacter?.itemId===item.id;
      const isProfile=data.profileCharacter?.category===item.category &&
        data.profileCharacter?.itemId===item.id;

      detail.classList.toggle("is-unowned",state==="unowned");
      detail.dataset.category=item.category;
      detail.dataset.itemId=item.id;
      if(collectionImage){
        collectionImage.onerror=()=>{
          collectionImage.onerror=null;
          collectionImage.src=item.preview;
        };
        collectionImage.src=state==="unowned" && isCharacterSkin(item.category)
          ? (item.profileImage || item.preview)
          : (item.collectionImage || item.preview);
        collectionImage.alt=item.name;
      }
      if(profileImage){
        profileImage.onerror=()=>{
          profileImage.onerror=null;
          profileImage.src=item.preview;
        };
        profileImage.src=item.profileImage || item.preview;
        profileImage.alt=`${item.name} プロフィール画像`;
      }
      names.forEach(name=>setText(name,item.name));
      setText(stateLabel,state==="equipped" ? "装備中" : state==="owned" ? "所持" : "🔒 未所持");
      if(equipButton){
        equipButton.textContent=getEquipLabel(item.category,state);
        equipButton.disabled=saving || state!=="owned";
        equipButton.onclick=()=>actions.onEquip(item.category,item.id);
      }
      if(favoriteButton){
        const characterSkin=isCharacterSkin(item.category);
        const canFavorite=characterSkin &&
          state!=="unowned" && item.id!=="default" && Boolean(item.homeImage);
        favoriteButton.hidden=!characterSkin;
        favoriteButton.textContent=state==="unowned"
          ? "🔒 未所持"
          : item.id==="default"
            ? "ホーム表示対象外"
            : isFavorite ? "ホーム表示中" : "ホームに表示";
        favoriteButton.disabled=saving || !canFavorite || isFavorite;
        favoriteButton.onclick=()=>actions.onFavorite(item.category,item.id);
      }
      if(profileButton){
        const characterSkin=isCharacterSkin(item.category);
        const canProfile=characterSkin && state!=="unowned" && Boolean(item.profileImage);
        profileButton.hidden=!characterSkin;
        profileButton.textContent=state==="unowned"
          ? "🔒 未所持"
          : isProfile ? "プロフィール適用中" : "プロフィールに適用";
        profileButton.disabled=saving || !canProfile || isProfile;
        profileButton.onclick=()=>actions.onProfile(item.category,item.id);
      }
      if(usageGuide){
        usageGuide.hidden=!isCharacterSkin(item.category);
      }
      if(usageBoard){
        usageBoard.classList.toggle("is-active",state==="equipped");
        setText(usageBoard.querySelector("small"),state==="equipped"
          ? "現在この見た目を使用中"
          : state==="unowned" ? "所持すると適用できます" : "下のボタンから変更できます");
      }
      if(usageHome){
        usageHome.classList.toggle("is-active",isFavorite);
        setText(usageHome.querySelector("small"),isFavorite
          ? "現在ホームに表示中"
          : state==="unowned" ? "所持すると表示できます" : item.id==="default"
            ? "追加スキンで利用できます" : "下のボタンから表示できます");
      }
      if(usageProfile){
        usageProfile.classList.toggle("is-active",isProfile);
        setText(usageProfile.querySelector("small"),isProfile
          ? "現在プロフィールに使用中"
          : state==="unowned" ? "所持すると設定できます" : "下のボタンから設定できます");
      }
      detail.classList.add("show");
      detail.setAttribute("aria-hidden","false");
    }

    function render({data,activeSection,selectedItem,saving}){
      if(!data || !content) return;
      setText(balance,String(data.nyanCoins));

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
        const grid=document.createElement("div");
        grid.className="collection-grid";
        catalog.getItemsByCategory(categoryId).forEach(item=>{
          grid.appendChild(createItemCard(item,data,saving));
        });
        group.append(heading,grid);
        content.appendChild(group);
      });
      renderDetail(data,selectedItem,saving);
    }

    function setBusy(isBusy){
      document.getElementById("collectionOverlay")?.classList.toggle("is-saving",isBusy);
    }

    function showError(message){
      setText(status,message);
      status?.classList.add("show");
      root?.setTimeout?.(()=>status?.classList.remove("show"),2600);
    }

    return {render,setBusy,showError};
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
      onEquip(categoryId,itemId){controller?.equip(categoryId,itemId);},
      onSelect(categoryId,itemId){controller?.selectItem(categoryId,itemId);},
      onFavorite(categoryId,itemId){controller?.setFavorite(categoryId,itemId);},
      onProfile(categoryId,itemId){controller?.setProfile(categoryId,itemId);}
    });
    controller=createController({playerData,catalog,view});

    openButton.addEventListener("click",async()=>{
      overlay.classList.add("show");
      overlay.setAttribute("aria-hidden","false");
      await controller.load();
    });

    backButton.addEventListener("click",()=>{
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
    getEquipLabel,
    getItemState,
    sanitizeCatalogEquipment,
    validateEquip,
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
