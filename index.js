let express = require('express');
let app = express();
let http = require('http').createServer(app);
let io = require("socket.io")(http);
let path = require("path");

let user = [];

let onKaynnissa = false;
let kierrokset = 0;
let hirttajaID = "";
let sana = "";
let hirttoIndex = -1;
let aika = 0;

app.use(express.static(path.join(__dirname, "resurssit")))
app.get("/", (req, res) => res.sendFile(__dirname + "/index.html"));
app.get("/taulu", (req, res) => res.json({user}));

io.on("connection", socket => {
  io.emit("onlineLista", user);
  socket.on("liittyy", e => {
    user.push(e);
    io.emit("liittyyChattiin", e.nimi);
    if(user.length > 1 && !onKaynnissa && !hirttajaID) seuraavaVuoro();
    io.emit("onlineLista", user);
    io.emit("lahetaTiedot", {onKaynnissa, sana, aika, hirttajaID, kierrokset});
    io.emit("hirttajaNakyma", user);
  });

  socket.on("viesti2", tiedot => {
    if(tiedot.id == hirttajaID) tiedot.hirttaja = true;
    io.emit("toimitaViesti", tiedot);
  });

  socket.on("lahetaTietoja", e => {
    for(let i = 0; i < user.length; i++) {
      if(user[i].id == e.id) {
        user[i].yritykset = e.yritykset;
        user[i].arvaus = e.arvaus;
        io.emit("onlineLista", user);
        io.emit("hirttajaNakyma", user);
        testaaPelaajia();
        break;
      } 
    };
  })

  socket.on("avainSana", e => {
    if(hirttajaID == e.id) {
      sana = e.viesti;
      onKaynnissa = true;
      aika = 90;
      kierrokset++;
      aloitaAjastin();
      paivitaSanaArvausUser("reset");
      io.emit("lahetaTiedot", {onKaynnissa, sana, aika, hirttajaID, kierrokset});
      io.emit("hirttajaNakyma", user);
      io.emit("onlineLista", user);
    };
  });

  socket.on("voitto2", e => {
    for(let i = 0; i < user.length; i++) {
      if(user[i].id == e.id) {
        user[i].pisteet = e.pisteet;
        user[i].arvannut = true;
        io.emit("voittajaIlmoitus", {nimi: e.nimi, aika});
        break;
      } 
    };
  });

  socket.on("havio2", taulu => {
    for(let i = 0; i < user.length; i++) {
      if(user[i].id == taulu.id) {
        user[i].havinnut = true;
        io.emit("havioIlmoitus", taulu.nimi);
        break;
      }
    }
  });

  socket.on("ohita", () => {
    seuraavaVuoro();
    io.emit("onlineLista", user);
  })

  socket.on("disconnect", e => {
    poistaKayttaja(socket.id);
    pelaajaPoistuu(socket.id);
    if(user.length == 1) io.emit("lahetaTiedot", {onKaynnissa, sana, aika, hirttajaID, kierrokset, reset: true});
    io.emit("onlineLista", user);
    if(user.length > 1) testaaPelaajia(); // jos hajuu poista toi
  });
});

function poistaKayttaja(val) {
  for(let i = 0; i < user.length; i++) {
    if(user[i].id == val) {
      user.splice(i, 1);
      break;
    }
  }
}

function testaaPelaajia() {
  let text = true;
  for(let i = 0; i < user.length; i++) {
    if(user[i].hirttaja) continue;
    if(user[i].arvannut) continue;
    if(user[i].havinnut) continue;
    text = false;
    break;
  }
  if(text) seuraavaVuoro();
}

function nollaaVoitotHaviot() {
  for(let i = 0; i < user.length; i++) {
    user[i].arvannut = false;
    user[i].havinnut = false;
  }
}

function paivitaSanaArvausUser(taulu) {
  for(let i = 0; i < user.length; i++) {
    if(taulu == "reset") {
      user[i].arvaus = luoKysymerkkiSana(sana);
      user[i].yritykset = 11;
    } else if(user[i].id == taulu.id) {
      user[i].arvaus = taulu.arvaus;
      user[i].yritykset = taulu.yritykset || taulu.havinnut;
      break;
    }
  };
};

function luoKysymerkkiSana(val) {
  let text = "";
  for(let i = 0; i < val.length; i++) {
    if(val[i] == " ") text += " ";
    else text += "?";
  } return text;
}

function pelaajaPoistuu(e) {
  if(e == hirttajaID) {
    if(user.length > 1) {
      seuraavaVuoro();
    } else {
      onKaynnissa = false;
      sana = "";
      hirttajaID = "";
    }
  } else {
    if(user.length < 2) {
      onKaynnissa = false;
      sana = "";
      hirttajaID = "";
      if(user.length == 1) user[0].hirttaja = false;
    }
  }
}

function seuraavaVuoro() {
  io.emit("kierrosViesti", sana);
  nollaaVoitotHaviot();
  if(hirttoIndex >= user.length - 1) hirttoIndex = 0;
  else hirttoIndex++;
  for(let i = 0; i < user.length; i++) {
    if(user[i].hirttaja) {
      user[i].hirttaja = false
      break;
    };
  };
  sana = "";
  user[hirttoIndex].hirttaja = true;
  io.emit("avaaPopUp", {id: user[hirttoIndex].id, aika});
  hirttajaID = user[hirttoIndex].id;
  hirttajaNimi = user[hirttoIndex].nimi;
  clearInterval(ajastin);
}

let ajastin;
function aloitaAjastin() {
  clearInterval(ajastin);
  ajastin = setInterval(() => {
    if(aika > 0) aika--;
    if(aika == 0) setTimeout(() => {
      lopetaAjastin();
    }, 500);
  }, 1000);
}

function lopetaAjastin() {
  clearInterval(ajastin);
  seuraavaVuoro();
}

http.listen(3000, function () {
  console.log('listening on *:3000');
});