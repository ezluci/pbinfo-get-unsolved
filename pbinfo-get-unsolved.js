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
title.innerHTML = '<span style="color: red";> pbinfo-get-unsolved.js</span>. <a href="https://github.com/ezluci/pbinfo-get-unsolved" target="_blank"><i>GitHub</i></a>'
document.body.appendChild(title)

const style = document.createElement('style')
style.innerHTML = `
   a:hover {
      cursor: pointer;
   }

   td {
      border: 1px solid black;
      user-select: none;
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
const sorted = {cnt: 1, id: 0, score: 0, difficulty: 0, postedBy_name: 0, author: 0, source: 0}
table.style.width = '75%'
table.style.minWidth = '450px'
table.style.maxWidth = '1050px'


function sortTable(sortType)
{
   if (sorted[sortType] === 0)
   {
      ['cnt', 'id', 'score', 'difficulty', 'postedBy_name', 'author', 'source'].filter((val) => {return val !== sortType}).forEach(type => {
         sorted[type] = 0
      })

      sorted[sortType] = 1
   }
   else
      sorted[sortType] *= -1
   
   if (sorted[sortType] === 1) // ascending
      for (let i = 0; i < problems.length; ++i)
         for (let j = i+1; j < problems.length; ++j)
            if (problems[i][sortType] > problems[j][sortType])
               [problems[i], problems[j]] = [problems[j], problems[i]] // swap
   if (sorted[sortType] === -1) // descending
      for (let i = 0; i < problems.length; ++i)
         for (let j = i+1; j < problems.length; ++j)
            if (problems[i][sortType] < problems[j][sortType])
               [problems[i], problems[j]] = [problems[j], problems[i]] // swap
   
   updateTable()
}


function updateTable() {

   function sortSymbol(sortType)
   {
      if (sorted[sortType] === 1)
         return '&#9660;'
      if (sorted[sortType] === -1)
         return '&#9650;'
      return '&#9654;'
   }

   function numberToDifficulty(nr)
   {
      if (nr === 0)
         return 'ușoară'
      if (nr === 1)
         return 'medie'
      if (nr === 2)
         return 'dificilă'
      if (nr === 3)
         return 'concurs'
   }

   function numberToDifficultyColor(nr)
   {
      if (nr === 0)
         return '5cb85c'
      if (nr === 1)
         return 'f0ad4e'
      if (nr === 2)
         return '5bc0de'
      if (nr === 3)
         return 'd9534f'
   }

   table.innerHTML = `
      <tr style="font-weight: bold;">
         <td style="min-width: 5em;"><a onclick="sortTable('cnt')">Contor ${sortSymbol('cnt')}</a></td>
         <td style="min-width: 10em;"><a onclick="sortTable('id')">Nume ${sortSymbol('id')}</a></td>
         <td style="min-width: 5em;"><a onclick="sortTable('score')">Punctaj ${sortSymbol('score')}</a></td>
         <td style="min-width: 6.5em;"><a onclick="sortTable('difficulty')">Dificultate ${sortSymbol('difficulty')}</a></td>
         <td style="min-width: 13em;"><a onclick="sortTable('postedBy_name')">Postată de ${sortSymbol('postedBy_name')}</a></td>
         <td style="min-width: 10em;"><a onclick="sortTable('author')">Autor ${sortSymbol('author')}</a></td>
         <td style="min-width: 10em;"><a onclick="sortTable('source')">Sursa problemei ${sortSymbol('source')}</a></td>
      </tr>
   `
   
   let i = 1
   problems.forEach(problem => {
      const row = document.createElement('tr')
      row.innerHTML = `
         <td>${problem.cnt}.</td>
         <td><a href="${problem.link}" target="_blank">#${problem.id} - ${problem.name}</a></td>
         <td>${problem.score}p</td>
         <td><span style="color: white; background-color:#${numberToDifficultyColor(problem.difficulty)};">${numberToDifficulty(problem.difficulty)}</span></td>
         <td><a target="_blank" href="${problem.postedBy_link}"><img style="vertical-align: middle; width: 1.1em;" src="${problem.postedBy_img}"> ${problem.postedBy_name}</a></td>
         <td>${problem.author}</td>
         <td>${problem.source}</td>
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
      let allProbsPage = 0


      for (let i = 0; i < pageProblems.length; ++i) {

         const cnt = problems.length + 1
         const id = parseInt(pageProblems[i].children[0].children[0].children[0].innerText.trim().slice(1))
         const name = pageProblems[i].children[0].children[0].children[1].innerText.trim()
         const link = pageProblems[i].children[0].children[0].children[1].href.trim()
         const difficulty = 
               (pageProblems[i].getElementsByClassName('list-unstyled list-inline')[0].innerText.includes('ușoară') ? 0 :
               pageProblems[i].getElementsByClassName('list-unstyled list-inline')[0].innerText.includes('medie') ? 1 :
               pageProblems[i].getElementsByClassName('list-unstyled list-inline')[0].innerText.includes('dificilă') ? 2 :
               3)
         let source = pageProblems[i].children[2].children[0].children[0]
         const postedBy_DOM = pageProblems[i].getElementsByClassName('fas fa-upload')[0].parentNode.children[1].children[0]
         const postedBy_link = postedBy_DOM.href
         const postedBy_name = postedBy_DOM.innerText.trim()
         let postedBy_img = postedBy_DOM.children[0].src
         if (new URL(postedBy_img).hostname === 'www.gravatar.com')
            postedBy_img = postedBy_img.replace(/&s=*/, '&s=128')
         else if (new URL(postedBy_img).hostname === 'www.pbinfo.ro')
            postedBy_img = postedBy_img.replace(/&gsize=*/, '&gsize=128')
         else
            console.error('pbinfo-get-unsolved.js\nUnknown link format for profile image')
         let author = pageProblems[i].getElementsByClassName('far fa-edit')[0]?.parentNode.innerText.trim()
         let score = parseInt(pageProblems[i].children[2].children[1].children[0].innerText.trim().slice(7).trim())

         if (problems.findIndex((val => {return val.id === id})) !== -1)
            continue

         allProbsPage ++

         if (source.tagName === 'P')
            source = source.innerText.trim()
         else
            source = ''

         if (!author)
            author = ''
         
         if (score === 100) {
            solvedProbsPage ++
         } else {
            if (isNaN(score))
               score = 0
            problems.push({cnt, id, name, link, difficulty, score, postedBy_link, postedBy_name, postedBy_img, author, source})
         }
      }
      
      if (pageProblems.length === 0) {
         updateTable()
         addLog(`<u>Am terminat de extras problemele.</u> Sunt ${problems.length} probleme nerezolvate. <a onclick="document.body.appendChild(table); window.scrollBy(0, 150)">Deschide tabelul cu probleme.</a>`)
         return
      } else {
         addLog(`Pagina ${pag} are ${solvedProbsPage}/${allProbsPage} probleme rezolvate.`)
      }

      Start(pag+1)
   }

   xhr.send()
}(1))