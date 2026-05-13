import fs from 'fs'
import path from 'path'

function walk(dir, filelist = []) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const filepath = path.join(dir, file)
    if (fs.statSync(filepath).isDirectory()) {
      filelist = walk(filepath, filelist)
    } else {
      if (filepath.endsWith('.tsx')) {
        filelist.push(filepath)
      }
    }
  }
  return filelist
}

const files = walk('./app/admin')

let changedCount = 0

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8')
  const original = content

  // Replace various card classes with the new mobile-first tokens
  content = content.replace(/bg-white rounded-(lg|xl|2xl) border border-gray-(100|200)/g, 'bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]')
  
  // Update some hardcoded text colors to semantic colors
  content = content.replace(/text-gray-900/g, 'text-primary')
  content = content.replace(/text-gray-500/g, 'text-on-surface-variant')
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8')
    changedCount++
    console.log(`Updated ${file}`)
  }
}

console.log(`Updated ${changedCount} files.`)
