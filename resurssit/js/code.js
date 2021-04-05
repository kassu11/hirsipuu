(function() {
  let socket = io();
  let id = null;
  let nimi = null;
  
  let aika = 0;
  let onKaynnissa = false;
  let maxYritykset = 11;
  let yritykset = maxYritykset;
  let sana = "";
  let selvitettySana = "";
  let kierros = 0;
  let pisteet = 0;
  let hirttajaTila = false;
  let arvatutKirjaimet = "";

  const mainBox = document.getElementById("mainBox");
  const form = document.getElementById("chat");
  const input = document.getElementById("input");
  const textBox = document.getElementById("textBox");
  const onlinetext = document.getElementById("onlinetext");
  const popup = document.getElementById("popup");
  const popupInput = document.getElementById("popupInput");
  const popupForm = document.getElementById("popupForm");
  const aikaText = document.getElementById("aikaText");
  const valittavaSanaNappi = document.getElementById("valittavaSanaNappi");
  const arvatutSanatBox = document.getElementById("arvatutSanatBox");

  input.focus();

  form.addEventListener("submit", e => {
    e.preventDefault();
    if(!input.value) return;
    if(id == null) {
      id = socket.id;
      nimi = input.value;
      socket.emit("liittyy", {id, nimi, hirttaja: false, arvannut: false, pisteet, havinnut: false, arvaus: "", yritykset});
      input.placeholder = `Laita viesti käyttäjänä: ${nimi}`;
    } else {
      if(tarkistaVoitto(input.value.toLowerCase())) {
        socket.emit("voitto2", {id, pisteet, nimi});
      } else {
        let voitto = selvitettySana.length > 2 ? selvitettySana == sana : false;
        socket.emit("viesti2", {id, viesti: input.value, nimi, voitto, havinnut: yritykset, hirttaja: false});
      } if(tarkistaHavio(input.value.toLowerCase())) socket.emit("havio2", {id, nimi});

      let voitto = selvitettySana.length > 2 ? selvitettySana == sana : false;
      if(input.value.length == 1) socket.emit("lahetaTietoja", {id, pisteet, yritykset, voitto, hirttaja: false, arvaus: selvitettySana});

      if(!hirttajaTila) luoArvattavaSanaVisual(selvitettySana);
      paivitaKierros();
    }
    input.value = "";

    function tarkistaVoitto(val) {
      if(val.length !== 1 || sana.indexOf(val) == -1 || yritykset == 0 || !onKaynnissa || selvitettySana.indexOf("?") == -1) return false;
      let text = "";
      for(let i = 0; i < sana.length; i++) {
        if(sana[i] == val) text += sana[i];
        else text += selvitettySana[i];
      } selvitettySana = text;
      if(text == sana) {
        pisteet += yritykset;
        return true;
      } 
    };

    function tarkistaHavio(val) {
      if(val.length !== 1 || yritykset == 0 || selvitettySana.indexOf("?") == -1 || !onKaynnissa) return false;
      if(sana.indexOf(val) == -1 && arvatutKirjaimet.indexOf(val) == -1) {
        yritykset--;
        arvatutKirjaimet += val;
        paivitaArvatutKirjaimet();
        if(yritykset == 0) return true;
      }
    };
  });

  socket.on("viestiSaapuu", e => {
    tarkistaScroll(viesti(e));
  })
  socket.on("toimitaViesti", tiedot => {
    tarkistaScroll(viesti2(tiedot));
  });
  socket.on("liittyyChattiin", e => {
    tarkistaScroll(liittymisIlmotus(e));
  });
  socket.on("onlineLista", users => {
    paivitaOnline(users);
    if(users.length < 2) {
      popup.style.display = "none";
      input.focus();
    }
  });
  socket.on("avaaPopUp", e => {
    if(aika !== 0) lopetaAjastin();
    aikaText.textContent = `${Math.floor(e.aika / 60)}:${e.aika % 60 < 10 ? `0${e.aika % 60}`:`${e.aika % 60}`}`;
    if(e.id == id) avaaPopup();
    else {
      popup.style.display = "none";
      hirttajaTila = false;
    };
  });
  socket.on("voittajaIlmoitus", e => {
    tarkistaScroll(voittoIlmoitus(e.nimi, e.aika));
  });
  socket.on("havioIlmoitus", e => {
    tarkistaScroll(haviamisIlmotus(e));
  });
  socket.on("kierrosViesti", sana => {
    tarkistaScroll(luoKierosViesti(sana));
  });
  socket.on("hirttajaNakyma", e => {
    if(hirttajaTila && sana.length > 2) paivitaHirttajaVisuaali(e);
  });

  socket.on("lahetaTiedot", e => {
    if(sana !== e.sana) arvatutKirjaimet = ""; // jos sana päivitetään nollaa arvatut kirjaimet
    paivitaArvatutKirjaimet();
    aika = e.aika;
    sana = e.sana;
    kierros = e.kierrokset;
    selvitettySana = luoSelvitettySana(sana);
    yritykset = 11;
    if(e.hirttajaID != id) {
      hirttajaTila = false;
      onKaynnissa = e.onKaynnissa;
    } else {
      onKaynnissa = false;
      hirttajaTila = true;
    } 
    if(e.onKaynnissa && sana.length > 1) aloitaAjastin();
    if(!hirttajaTila) luoArvattavaSanaVisual(selvitettySana);
    paivitaKierros();
    if(e.reset) {
      aikaText.textContent = `1:30`;
      lopetaAjastin();
    }
  });

  function paivitaHirttajaVisuaali(taulu) {
    let scrollattavaMaara = scrollMaara();

    mainBox.classList = "hirttaja";
    arvatutSanatBox.textContent = "";

    // luo alkuperäsen sanan päälle

    let otsikkoBox = document.createElement("div");
    otsikkoBox.classList.add("hirttajaNakymaSana");

    let spanOtsikko = document.createElement("span");
    spanOtsikko.textContent = `Arvattava sana`;
    spanOtsikko.classList.add("onlinepep", "hirttajaArvattavaSana", "hirttajaNakyma");
    arvatutSanatBox.appendChild(spanOtsikko);

    for(let i = 0; i < sana.length; i++) {
      let divOtsikko = document.createElement("div");
      if(sana[i] == " ") divOtsikko.classList.add("arvattavaKirjainVali");
      else divOtsikko.classList.add("arvattavaKirjain");
      let pOtsikko = document.createElement("p");
      pOtsikko.textContent = sana[i];
      divOtsikko.appendChild(pOtsikko);
      
      otsikkoBox.appendChild(divOtsikko);
    } arvatutSanatBox.appendChild(otsikkoBox);
    
    // luo alkuperäsen sanan päälle

    for(let yks of taulu) {
      if(yks.hirttaja) continue;
      let text = yks.arvaus || selvitettySana;
      let paaBox = document.createElement("div");
      paaBox.classList.add("hirttajaNakymaSana");

      let span = document.createElement("span");
      let span2 = document.createElement("span");
      span.textContent = `${yks.nimi}`;
      span2.textContent = `${yks.yritykset}`
      span2.classList.add("onlineScore");
      if(yks.arvannut) span2.classList.add("onlineArvannutScore");
      else if(yks.havinnut) span2.classList.add("onlineHavinnuScore");
      span.appendChild(span2);
      span.classList.add("onlinepep");
      if(yks.arvannut) span.classList.add("onlineArvannut");
      else if(yks.havinnut) span.classList.add("onlineHavinnu");
      span.classList.add("hirttajaNakyma");
      arvatutSanatBox.appendChild(span);

      for(let i = 0; i < text.length; i++) {
        let div = document.createElement("div");
        if(text[i] == " ") div.classList.add("arvattavaKirjainVali");
        else div.classList.add("arvattavaKirjain");
        if(text[i] != "?") {
          let p = document.createElement("p");
          p.textContent = text[i];
          div.appendChild(p);
        }
        paaBox.appendChild(div);
      }
      arvatutSanatBox.appendChild(paaBox);
    }

    let alaViivaus = document.createElement("div");
    alaViivaus.classList.add("hirttajaAlaviivaus");
    arvatutSanatBox.appendChild(alaViivaus);

    textBox.scrollBy(0, scrollattavaMaara);

    function scrollMaara() {
      if(textBox.scrollHeight - (textBox.offsetHeight + textBox.scrollTop) <= 0) {
        return 5000;
      } return 0;
    }
  }

  function paivitaKierros() {
    document.getElementById("kierrosText").textContent = `Kierros: ${kierros}`;
    document.getElementById("yritykset").textContent = `Yritykset: ${yritykset}`;
  }

  function luoSelvitettySana(tieto) {
    let text = "";
    for(let i = 0; i < tieto.length; i++) {
      if(tieto[i] !== " ") text += "?";
      else text += " ";
    } return text;
  }

  function luoArvattavaSanaVisual(val) {
    mainBox.classList = "";
    arvatutSanatBox.textContent = "";
    let paaDiv = document.createElement("div");
    paaDiv.classList = "arvattavaSana";
    if(val.length > 0) paaDiv.style.transform = "translateX(-50%) scale(1)";
    else paaDiv.style.transform = "translateX(-50%) scale(0)";
    for(let i = 0; i < val.length; i++) {
      let div = document.createElement("div");
      if(val[i] == " ") div.classList.add("arvattavaKirjainVali");
      else div.classList.add("arvattavaKirjain");
      if(val[i] != "?") {
        let p = document.createElement("p");
        p.textContent = val[i];
        div.appendChild(p);
      }
      paaDiv.appendChild(div);
      arvatutSanatBox.appendChild(paaDiv);
    }
  }

  function viesti2(tieto) {
    let p = document.createElement("p");
    let span = document.createElement("span");
    span.textContent = `${tieto.nimi}`;
    span.classList.add("chattiUser");
    if(tieto.voitto) span.classList.add("onlineArvannut");
    else if(tieto.havinnut <= 0) span.classList.add("onlineHavinnu");
    else if(tieto.hirttaja) span.classList.add("onlineHirttaja");
    p.appendChild(span);
    p.innerHTML += `${tieto.viesti}`;
    p.classList.add("chattiViesti");
    textBox.insertBefore(p, document.getElementById("loppuviiva"));
    return p;
  }

  function liittymisIlmotus(nimi) {
    let p = document.createElement("p");
    let span = document.createElement("span");
    span.textContent = `${nimi}`;
    span.classList.add("chattiUserLiittyy")
    p.appendChild(span)
    p.innerHTML += `Liittyi palvelimelle`;
    p.classList.add("chattiViesti");
    textBox.insertBefore(p, document.getElementById("loppuviiva"));
    return p;
  }

  function voittoIlmoitus(nimi, aika2) {
    let fakeAika = 90 - aika2;
    let p = document.createElement("p");
    let span = document.createElement("span");
    p.textContent = `Pelaaja `
    span.textContent = `${nimi}`;
    span.classList.add("chattiUserLiittyy");
    span.classList.add("onlineArvannut");
    p.appendChild(span)
    p.innerHTML += `voitti ajalla ${`${Math.floor(fakeAika / 60)}:${fakeAika % 60 < 10 ? `0${fakeAika % 60}`:`${fakeAika % 60}`}`}`;
    p.classList.add("chattiViesti");
    textBox.insertBefore(p, document.getElementById("loppuviiva"));
    return p;
  }

  function haviamisIlmotus(nimi) {
    let p = document.createElement("p");
    let span = document.createElement("span");
    p.textContent = `Valitettasti `
    span.textContent = `${nimi}`;
    span.classList.add("chattiUserLiittyy");
    span.classList.add("onlineHavinnu");
    p.appendChild(span)
    p.innerHTML += `on poissa pelistä`;
    p.classList.add("chattiViesti");
    textBox.insertBefore(p, document.getElementById("loppuviiva"));
    return p;
  }

  function paivitaArvatutKirjaimet() {
    document.getElementById("arvatutKirjaimetBox").textContent = "";
    if(arvatutKirjaimet.length < 1) return;
    let span = document.createElement("span");
    span.textContent = arvatutKirjaimet;
    span.classList.add("arvatutKirjaimet");
    document.getElementById("arvatutKirjaimetBox").appendChild(span);
  }

  function luoKierosViesti(nimi) {
    if(nimi.length < 3) return false;
    let p = document.createElement("p");
    let span = document.createElement("span");
    p.textContent = `# Kierros ${kierros} loppui ja sen sana oli `
    span.textContent = `${nimi}`;
    span.classList.add("kierrosSana");
    p.appendChild(span)
    p.classList.add("serverViesti");
    textBox.insertBefore(p, document.getElementById("loppuviiva"));
    return p;
  }

  function paivitaOnline(taulu) {
    onlinetext.textContent = "";
    for(let solu of taulu) {
      let span = document.createElement("span");
      let span2 = document.createElement("span");
      span.textContent = `${solu.nimi}`;
      span2.textContent = `${solu.pisteet}`
      span2.classList.add("onlineScore");
      if(solu.hirttaja) span2.classList.add("onlineHirttajaScore");
      else if(solu.arvannut) span2.classList.add("onlineArvannutScore");
      else if(solu.havinnut) span2.classList.add("onlineHavinnuScore");
      span.appendChild(span2);
      span.classList.add("onlinepep");
      if(solu.hirttaja) span.classList.add("onlineHirttaja");
      else if(solu.arvannut) span.classList.add("onlineArvannut");
      else if(solu.havinnut) span.classList.add("onlineHavinnu");
      onlinetext.appendChild(span);
    }
  }

  function tarkistaScroll(e) {
    let marginBottom = 4;
    if(textBox.scrollHeight - (textBox.offsetHeight + textBox.scrollTop + e.offsetHeight + marginBottom) <= 0) {
      textBox.scrollBy(0, e.offsetHeight + marginBottom);
    }
  }

  function avaaPopup() {
    popup.style.display = "block";
    popupInput.focus();
  };

  popupInput.addEventListener("input", e => {
    let text = popupInput.value;
    vihree();
    if(text.length >= 25 || text.length < 3) punanen();
    if(text.indexOf("?") !== -1) punanen();
    if(text.indexOf(".") !== -1) punanen();
    if(text.indexOf(",") !== -1) punanen();
    if(text.indexOf("!") !== -1) punanen();

    function punanen() {
      valittavaSanaNappi.classList.add("nappiPunanen");
      valittavaSanaNappi.classList.remove("nappiVihree");
    }

    function vihree() {
      valittavaSanaNappi.classList.remove("nappiPunanen");
      valittavaSanaNappi.classList.add("nappiVihree");
    }
  });

  document.getElementById("ohitaNappi").addEventListener("click", e => {
    socket.emit("ohita");
    popupInput.value = "";
    popup.style.display = "none";
  });

  popupForm.addEventListener("submit", e => {
    e.preventDefault();
    if(popupInput.value && popupInput.value.length < 25 && popupInput.value.length > 2) {
      if(popupInput.value.indexOf("?") !== -1 || popupInput.value.indexOf(".") !== -1 || popupInput.value.indexOf(",") !== -1 || popupInput.value.indexOf("!") !== -1) return;
      popup.style.display = "none";
      valittavaSanaNappi.classList.add("nappiPunanen");
      valittavaSanaNappi.classList.remove("nappiVihree");
      socket.emit("avainSana", {id, viesti: popupInput.value.toLowerCase()});
      input.focus();
      popupInput.value = "";
    }
  });

  let ajastin;
  function aloitaAjastin() {
    aikaText.textContent = `1:30`;
    clearInterval(ajastin);
    aikaText.textContent = `${Math.floor(aika / 60)}:${aika % 60 < 10 ? `0${aika % 60}`:`${aika % 60}`}`;
    ajastin = setInterval(() => {
      if(aika > 0) aika--;
      if(aika < 10) aikaText.classList.add("kelloAnimaatio");
      if(aika > 10) aikaText.classList.remove("kelloAnimaatio");
      if(aika < 1) lopetaAjastin();
      aikaText.textContent = `${Math.floor(aika / 60)}:${aika % 60 < 10 ? `0${aika % 60}`:`${aika % 60}`}`;
    }, 1000);
  }

  function lopetaAjastin() {
    onKaynnissa = false;  // korjaa ongelman missä aika loppuu ja sen jälkeen on mahollista hävitä peli jos kirjoittaa vääriä kirjaimia eikä sanaa ole vielä valittu
    clearInterval(ajastin);
    aikaText.classList.remove("kelloAnimaatio");
  }

})();