// Promisifing the XMLHttpRequest so we can use .then and .catch.
let Request = (() => {

    //for a GET request
    let get = (url) => {
        return new Promise((resolve, reject) => {
            let request = new XMLHttpRequest();
            request.open("GET", url);
            request.addEventListener('load', function () {
                if (this.status === 200) {
                    //if the status is 200 just parse everything as JSON
                    // and return the notes
                    resolve(JSON.parse(this.responseText))
                } else {
                    reject(this.responseText)
                }
            });

            request.send();

        })
    };

    //for a POST request
    let post = (url, data) => {
        return new Promise((resolve, reject) => {
            let request = new XMLHttpRequest();
            request.open("POST", url);
            request.setRequestHeader("Content-type", "application/json");
            request.addEventListener('load', function () {
                if (this.status === 200) {
                    //if the status is 200 just parse everything as JSON
                    // and return the notes
                    resolve(JSON.parse(this.responseText))
                } else {
                    console.log(this)
                    reject(this.responseText)
                }
            });

            request.send(JSON.stringify(data));

        })
    };

    return {
        get, post
    }

})();


let UIController = (() => {

    let _DOM = {
        title   : "title",
        content : "content",
        postBtn : "postBtn",
        noteList: "noteList",
        footer  : "footer",
        location: ".location"
    };


    return {
        DOM             : _DOM,
        getNote         : () => {

            //get the content from the inputs.
            let title   = document.getElementById(_DOM.title).value;
            let content = document.getElementById(_DOM.content).value;


            return {
                title, content
            }

        },
        clearNote       : () => {
            let title   = document.getElementById(_DOM.title);
            let content = document.getElementById(_DOM.content);

            title.value   = "";
            content.value = "";

            title.focus()

        },
        insertNoteInList: (noteHtml) => {

            let noteList = document.getElementById(_DOM.noteList);
            noteList.insertAdjacentHTML('afterbegin', noteHtml)

        },
        setLocation     : (location) => {
            let locationDOM = document.querySelector(_DOM.location);

            let template = '<img src="$flag_url$" width="35" height="20" alt="flag"><p>You are posting from $location$</p>';


            let locationHtml = template.replace('$flag_url$', location.flag_url);
            locationHtml     = locationHtml.replace('$location$', location.location);


            locationDOM.innerHTML = locationHtml;
        }

    }

})();


let Store = (() => {


    let _store = {
        notes   : [],
        instance: {},
        location: {}
    };


    function Note(content, title, country) {
        this.content      = content;
        this.title        = title;
        this.country_code = country;
    }

    function Location(ip, location, country_code, flag_url) {
        this.ip           = ip;
        this.location     = location;
        this.country_code = country_code;
        this.flag_url     = flag_url;
    }


    Note.prototype.addNote = function () {
        _store.notes.push(this);
    };

    return {

        // rehydration functions
        rehydrateNotesState   : (notes) => {
            return _store.notes = notes.map((n) => {
                return new Note(n.content, n.title, n.country_code)
            })
        },
        rehydrateInstanceState: (instance) => {
            return _store.instance = instance;
        },

        // CRUD
        addNote: (content, title, country) => {
            let n = new Note(content, title, country);
            n.addNote();
            return n;
        },

        setLocation: (ip, location, country_code, flag_url) => {
            return _store.location = new Location(ip, location, country_code, flag_url)
        },

        getLocation: () => {
            return _store.location;
        },

        //get information from store
        getNotes          : () => {
            return _store.notes;
        },
        getInstanceDetails: () => {
            return _store.instance;
        }
    }

})();

let AppController = ((store, ui) => {


    function init() {

        //1. focus the client on the title input
        document.getElementById(ui.DOM.title).focus();


        //2. Get existing notes from a server
        Request.get('http://notes-lb-1614696031.eu-west-1.elb.amazonaws.com/note')
            .then(req => {
                //rehydrate the notes
                rehydrateNotes(req.data);
                //rehydrate the instance data
                rehydrateInstance(req.instance)

            })
            .catch(err => {
                console.log("error when retrieving data - ", err);
                rehydrateNotes([])
            });

        Request.get('http://notes-lb-1614696031.eu-west-1.elb.amazonaws.com/location')
            .then(req => {


                let location = store.setLocation(req.ip, req.location, req.country_code, req.flag_url);
                ui.setLocation(location);

            })
            .catch(err => {
                console.log("error when retrieving location - ", err);

            });


    }

    //function used to get the state received from the store and
    //add the elements inside the app.
    function rehydrateNotes(from_server) {
        //add notes to state
        let state = store.rehydrateNotesState(from_server);


        //create container element that will hold all notes
        let ul = document.createElement("ul");
        ul.id  = ui.DOM.noteList;

        //run through all notes in array and generate a DOM node.
        state.forEach((note) => {
            let li       = document.createElement('template');
            li.innerHTML = generateNoteHtml(note);
            ul.appendChild(li.content.firstChild);

        });

        //find the content and insert the newly created list in DOM list
        //right before the footer.
        let content = document.querySelector('.content');
        content.insertBefore(ul, document.getElementById('footer'));

    }

    //function to rehydrate the instance information received from server.
    function rehydrateInstance(from_server) {
        //add notes to state
        let state = store.rehydrateInstanceState(from_server);

        //add the information to the footer element.
        document.getElementById(ui.DOM.footer).innerHTML = generateInstanceHtml(state);


    }


    //generate the template based on the note object.
    function generateNoteHtml(note) {
        const template = '<li><h1>$title$</h1><p>$content$</p><div><img src="http://www.geognos.com/api/en/countries/flag/$country$.png" alt=""><p>Posted from Romania | At 20:06 PM 10/12/2017</p></div></li>';

        let noteHtml = template.replace('$title$', note.title);
        noteHtml     = noteHtml.replace('$content$', note.content);
        noteHtml     = noteHtml.replace('$country$', note.country_code);

        return noteHtml;
    }

    //generate the template based on the instance object.
    function generateInstanceHtml(instanceDetails) {
        const template = '<p>App version 1.0. Last API call came from the instance <span>$instanceId$</span> found in region <span>$region$</span>, Availability Zone <span>$availabilityZone$</span>, with private IP <span>$privateIp$</span></p>';

        let instanceHtml = template.replace('$instanceId$', instanceDetails.instanceId);
        instanceHtml     = instanceHtml.replace('$region$', instanceDetails.region);
        instanceHtml     = instanceHtml.replace('$availabilityZone$', instanceDetails.availabilityZone);
        instanceHtml     = instanceHtml.replace('$privateIp$', instanceDetails.privateIp);

        return instanceHtml;
    }



    //get elements
    //TODO refactor to get an element directly
    let btn = document.getElementById(ui.DOM.postBtn);


    // event listeners functions.
    let addNote = () => {

        //get note content from UI.
        let note = ui.getNote();

        //If i don't have the content or title chug an error.
        if (note.content && note.title) {

            //1. Add note in store
            let noteObj = store.addNote(note.content, note.title, store.getLocation().country_code);


            //2. add to server

            Request.post('http://notes-lb-1614696031.eu-west-1.elb.amazonaws.com/note', {
                title   : noteObj.title,
                content : noteObj.content,
                location: store.getLocation()
            }).then(req => {

                //3. Add note to DOM
                ui.insertNoteInList(generateNoteHtml(noteObj));

                //4. clear is separate as i might have to retry server call
                ui.clearNote();

            }).catch(err => {
                console.log("error when posting note to server - ", err);

            });

            //clear is separate as i might have to retry server call
            ui.clearNote();
        } else {

            //TODO work with errors...
            console.log("not all fields boys...")
        }
    };


    // add event listeners
    btn.addEventListener('click', addNote);
    document.addEventListener('keypress', (e) => {
        if (e.code === "Enter") {
            addNote()
        }
    });


    //initialize
    init()


})(Store, UIController);
