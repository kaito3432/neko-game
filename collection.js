/* にゃんチェイス - Phase 2A コレクション画面
   プレイヤーデータの表示と安全な装備変更だけを担当する。
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

    return {
      data:changed ? {...data,equippedAppearance} : data,
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

  function createController({playerData,catalog=defaultCatalog,view={}}={}){
    let currentData=null;
    let activeSection="cat";
    let saving=false;

    function render(){
      view.render?.({data:currentData,activeSection,saving});
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

    function getState(){
      return {data:currentData,activeSection,saving};
    }

    return {load,setSection,equip,getState};
  }

  function createDomView(document,catalog,onEquip){
    const balance=document.getElementById("collectionCoinBalance");
    const content=document.getElementById("collectionContent");
    const status=document.getElementById("collectionStatus");
    const tabs=[...document.querySelectorAll("[data-collection-section]")];

    function setText(element,text){
      if(element) element.textContent=text;
    }

    function createItemCard(item,data,saving){
      const category=catalog.getCategory(item.category);
      const state=getItemState(data,item,catalog);
      const card=document.createElement("article");
      card.className=`collection-item is-${state}`;

      const preview=document.createElement("div");
      preview.className="collection-item-preview";
      const image=document.createElement("img");
      image.src=item.preview;
      image.alt=`${category.label} ${item.name}`;
      preview.appendChild(image);

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
      button.textContent=state==="equipped" ? "装備中" : state==="owned" ? "装備する" : "未所持";
      button.disabled=saving || state!=="owned";
      button.addEventListener("click",()=>onEquip(item.category,item.id));

      card.append(preview,copy,button);
      return card;
    }

    function render({data,activeSection,saving}){
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
    const view=createDomView(document,catalog,(categoryId,itemId)=>{
      controller?.equip(categoryId,itemId);
    });
    controller=createController({playerData,catalog,view});

    openButton.addEventListener("click",async()=>{
      overlay.classList.add("show");
      overlay.setAttribute("aria-hidden","false");
      await controller.load();
    });

    backButton.addEventListener("click",()=>{
      overlay.classList.remove("show");
      overlay.setAttribute("aria-hidden","true");
      openButton.focus();
    });

    document.querySelectorAll("[data-collection-section]").forEach(tab=>{
      tab.addEventListener("click",()=>controller.setSection(tab.dataset.collectionSection));
    });

    return controller;
  }

  const api=Object.freeze({
    SECTION_CATEGORIES,
    getItemState,
    sanitizeCatalogEquipment,
    validateEquip,
    createController,
    initializeBrowser
  });

  if(root?.document){
    initializeBrowser();
  }

  return api;
});
