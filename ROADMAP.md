# Roadmap

- [x] Scrollbars per column, auto appears based on length
- [ ] Folder manipulation - rename existing folder, add a new folder
  - [x] UI - Adopted approach by Bookmark Sidebar Extension (Philip Koenig)
  - [x] Add a pencil, + icon over the folders to the right and a pencil icon to the bookmark url
  - [x] On clicking the pencil icon, the edit bookmark modal pops up.
  - [x] The edit bookmark icon must not open page in new tab in background
    - Solution was to use preventDefault, stopPropagation
  - [x] DONE Clicking the pencil or plus icon must not toggle the folder
  - [ ] On clicking the pencil icon, the name of the folder is editable in place
  - [ ] On clicking the + icon, a modal pops for adding bookmark / folder / separator
  - [ ] Advanced - control placement of pencil, plus icons (order, avoid new row)
  - [ ] Advanced - Quick add icons on hover of a bookmark, folder (location of event)
- [ ] Make Drag & Drop more fluid or flexible - new columns, rows can be created
- [ ] Highlight the modification of presentation in Green, structure in red
- [ ] Improved Drag & Drop - for moving within a closed folder (open folder first)
- [ ] Snapshot - allow user to save, rename previous snapshots.
- [ ] Global Search at the top - filter open columns, highlight folders (with counts)
