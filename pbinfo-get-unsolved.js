// restoring console.log: https://stackoverflow.com/questions/7089443/restoring-console-log
var i = document.createElement('iframe')
i.style.display = 'none'
document.body.appendChild(i)
window.console = i.contentWindow.console
console.clear()


// link prompt
let pageLink = prompt('Pune un link catre categoria de probleme de unde vrei sa obtii problemele nerezolvate.\nMergi la o clasa, alege o categorie, si copiaza link-ul aici.\n\nExemple:\n\nhttps://www.pbinfo.ro/probleme/categorii/5/algoritmi-elementari-cifrele-unui-numar\n\nhttps://www.pbinfo.ro/?pagina=probleme-lista&disciplina=0&clasa=-1&dificultate=0&folosesc_consola=-1&eticheta=52')
pageLink = pageLink.replaceAll(/(\?|&)start\d+/g, '')


// clearing site
document.head.innerHTML = ''
document.body.innerHTML = ''


// css
const style = document.createElement('style')
style.innerText = `
   .logMessage {
      display: block;
   }
`
document.head.appendChild(style)


// logging
const logDiv = document.createElement('div')
logDiv.id = 'log'
document.body.appendChild(logDiv)

function addLog(msg) {

   const date = new Date()
   const msgEl = document.createElement('span')
   msgEl.innerHTML = '<b>[' + date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0') + ':' + date.getSeconds().toString().padStart(2, '0') + '] - </b>' + msg
   msgEl.classList += 'logMessage'

   logDiv.appendChild(msgEl)
   window.scroll(0, logDiv.scrollHeight)
}


// start script
const reqPageEl = document.createElement('div')
reqPageEl.style.display = 'none'
document.body.appendChild(reqPageEl)
addLog(`Link catre categoria de probleme: <a href="${pageLink}"><i>${pageLink}</i></a>`)

const problems = []


function logAllProblems() {
   addLog(`<u>Am terminat de extras problemele.</u> Sunt ${problems.length} probleme nerezolvate:`)
   problems.forEach(problem => {
      addLog(`<a href="${problem.link}">#${problem.id} - ${problem.name}</a> (${problem.score}p)`)
   })
}


(async function Start(pag) {
   
   const xhr = new XMLHttpRequest()
   xhr.open('get', pageLink + (pageLink.includes('?') ? '&' : '?') + 'start=' + 10*(pag-1))
   xhr.setRequestHeader('Content-Type', 'text/plain')

   xhr.onload = () => {

      reqPageEl.innerHTML = xhr.response
      const pageProblems = reqPageEl.getElementsByClassName('col-lg-8 col-md-8')[0].getElementsByClassName('panel panel-info')
      let solvedProbsPage = 0


      for (let i = 0; i < pageProblems.length; ++i) {

         const id = pageProblems[i].children[0].children[0].children[0].innerText.trim().slice(1)
         const name = pageProblems[i].children[0].children[0].children[1].innerText.trim()
         const link = pageProblems[i].children[0].children[0].children[1].href.trim()
         let score = pageProblems[i].children[2].children[1].children[0].innerText.trim().slice(7).trim()

         if (score === '100') {
            solvedProbsPage ++
         } else {
            if (score === '')
               score = '0'
            problems.push({id: id, name: name, link: link, score: score})
         }
      }
      
      if (pageProblems.length === 0) {
         logAllProblems()
         return
      } else {
         addLog(`Pagina ${pag} are ${solvedProbsPage}/${pageProblems.length} probleme rezolvate.`)
      }

      Start(pag+1)
   }

   xhr.send()
}(1))
