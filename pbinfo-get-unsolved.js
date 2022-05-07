// restoring console.log: https://stackoverflow.com/questions/7089443/restoring-console-log
var i = document.createElement('iframe')
i.style.display = 'none'
document.body.appendChild(i)
window.console = i.contentWindow.console
console.clear()


// link prompt
let pageLink = prompt('Pune un link către categoria de probleme de unde vrei să obții problemele nerezolvate.\nMergi la o clasă, alege o categorie, și copiază link-ul aici.\n\nExemple:\n\nhttps://www.pbinfo.ro/probleme/categorii/5/algoritmi-elementari-cifrele-unui-numar\n\nhttps://www.pbinfo.ro/?pagina=probleme-lista&disciplina=0&clasa=-1&dificultate=0&folosesc_consola=-1&eticheta=52')
pageLink = pageLink.replaceAll(/(\?|&)start\d+/g, '')


// clearing site
document.head.innerHTML = ''
document.body.innerHTML = ''

const title = document.createElement('h2')
title.style.display = 'block'
title.innerHTML = '<span style="color: red"> pbinfo-get-unsolved.js</span>. <a href="https://github.com/ezluci/pbinfo-get-unsolved" target="_blank"><i>GitHub</i></a>'
document.body.appendChild(title)

const style = document.createElement('style')
style.innerHTML = `
   a:hover {
      cursor: pointer;
   }

   td {
      border: 1px solid black;
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
   msgEl.style.display = 'block'
 
   logDiv.appendChild(msgEl)
   window.scroll(0, logDiv.scrollHeight)
}


// start script
const reqPageEl = document.createElement('div')
reqPageEl.style.display = 'none'
document.body.appendChild(reqPageEl)
addLog(`Link către categoria de probleme: <a href="${pageLink}"><i>${pageLink}</i></a>`)

const problems = []
let table = document.createElement('table')
table.style.width = '40%'
table.style.minWidth = '350px'
table.style.maxWidth = '500px'


function createProblemsTable() {

   table.innerHTML = `
      <tr style="font-weight: bold;">
         <td>Nume</td>
         <td>Punctaj</td>
         <td>Dificultate</td>
      </tr>
   `
   
   problems.forEach(problem => {
      const row = document.createElement('tr')
      row.innerHTML = `
         <td><a href="${problem.link}" target="_blank">#${problem.id} - ${problem.name}</a></td>
         <td>${problem.score}p</td>
         <td><span style="color: white; background-color:#${problem.difficulty === 'ușoară' ? '5cb85c' : problem.difficulty === 'medie' ? 'f0ad4e' : problem.difficulty === 'dificilă' ? '5bc0de' : 'd9534f'}">${problem.difficulty}</span></td>
      `

      table.appendChild(row)
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
         const difficulty = 
               (pageProblems[i].getElementsByClassName('list-unstyled list-inline')[0].innerText.includes('ușoară') ? 'ușoară' :
               pageProblems[i].getElementsByClassName('list-unstyled list-inline')[0].innerText.includes('medie') ? 'medie' :
               pageProblems[i].getElementsByClassName('list-unstyled list-inline')[0].innerText.includes('dificilă') ? 'dificilă' :
               'concurs')
         let score = pageProblems[i].children[2].children[1].children[0].innerText.trim().slice(7).trim()

         if (score === '100') {
            solvedProbsPage ++
         } else {
            if (score === '')
               score = '0'
            problems.push({id: id, name: name, link: link, difficulty: difficulty, score: score})
         }
      }
      
      if (pageProblems.length === 0) {
         createProblemsTable()
         addLog(`<u>Am terminat de extras problemele.</u> Sunt ${problems.length} probleme nerezolvate. <a onclick="document.body.appendChild(table)">Deschide tabelul cu probleme.</a>`)
         return
      } else {
         addLog(`Pagina ${pag} are ${solvedProbsPage}/${pageProblems.length} probleme rezolvate.`)
      }

      Start(pag+1)
   }

   xhr.send()
}(1))