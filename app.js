const pages = document.querySelectorAll('.page');
const crumb = document.getElementById('breadcrumb');
const sidebar = document.getElementById('sidebar');
const toast = document.getElementById('toast');
function showToast(message){toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2800)}
function navigate(id){pages.forEach(page=>page.classList.toggle('hidden',page.id!==id));document.querySelectorAll('.nav-item').forEach(item=>item.classList.toggle('active',item.dataset.page===id));crumb.textContent=document.querySelector(`[data-page="${id}"] b`)?.textContent||id[0].toUpperCase()+id.slice(1);history.replaceState(null,'',`#${id}`);sidebar.classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});}
document.querySelectorAll('[data-page]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();navigate(link.dataset.page)}));
document.getElementById('menuBtn').addEventListener('click',()=>sidebar.classList.toggle('open'));
document.getElementById('collapseBtn').addEventListener('click',()=>{sidebar.classList.toggle('collapsed');showToast('Navigation collapsed')});
document.getElementById('continueBtn').addEventListener('click',()=>navigate('learning'));
document.getElementById('resumeBtn').addEventListener('click',()=>showToast('Resuming: Data visualization with Matplotlib'));
document.getElementById('launchBtn').addEventListener('click',()=>showToast('Your Gateway Cloud Workbench is ready to launch.'));
document.querySelectorAll('.join').forEach(btn=>btn.addEventListener('click',()=>showToast('Opening your live class…')));
const hash=location.hash.slice(1);if(hash&&document.getElementById(hash))navigate(hash);
