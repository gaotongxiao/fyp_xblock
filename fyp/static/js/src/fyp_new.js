var server_addr = "http://model.dyfyp.club:8081";
var xmpp_server_addr = "http://ejab.dyfyp.club:8081/http-bind"
function Chat(runtime, element) {
    var public_room = 'room3@conference.localhost';
    var current_room = null;
    var mode = 0; // 0: robot; 1: TA; 2: Room
    function join_room(jid, room, callback) {
        if (current_room === null) {
            $.xmpp.joinRoom(jid, room, jid.split('@')[0], callback);
        }
        else {
            $.xmpp.quitRoom(jid, current_room, jid.split('@')[0], function(data){
                $.xmpp.joinRoom(jid, room, jid.split('@')[0], callback);
            });
        }
        current_room = room;
    }
    function append_message(message) {
        $("#messages").append("<div class=\"message to ready\">"+ message + "</div>");
        $(".conv-form-wrapper").find('#messages').stop().animate({scrollTop: $(".conv-form-wrapper").find('#messages')[0].scrollHeight}, 600);
    }
    jQuery(function($){
        var count = 0;
        var temp_res = null;
        var user_question = null;
        var findUserUrl = runtime.handlerUrl(element, 'find_users');
        var checkRoomUserUrl = runtime.handlerUrl(element, 'check_room_users');
        var score_threshold = 0.3;
        var convForm = $('#chat').convform({eventList:{onInputSubmit: function(convState, ready) {
            function alert_fail() {
                convState.current.next = convState.newState({
                    type: 'input',
                    questions: ['Congratulations! Server is crashed.', 'The robot has left the chat.', 'Bye.']
                });
                ready();
            }
            function ret_sim_ques(Q, res) {
                for (i = 0; i < res['ids'].length; i++) {
                    Q += "<hr /><a target=\"_blank\" href=https://stackoverflow.com/questions/" + res['ids'][i] + ">" + res['best_title'][i] + "</a>";
                }
                convState.current.next = convState.newState({
                    type: 'input',
                    questions: [Q],
                    noAnswer: true
                });
                convState.current.next.next = convState.newState({
                    type: 'select',
                    questions: ['You may also ask for other\'s help'],
                    answers: [ {text:'Find Help', value:'fh'},
                                {text:'No, Thanks', value:'nt' }]
                });
                ready();
            }
            if(convState.current.answer.value==='eval:1' || convState.current.answer.value==='eval:2' || convState.current.answer.value==='eval:3') {
                //convState.current.next = false;
                //emulating random response time (100-600ms)
                //setTimeout(ready, Math.random()*500+100);
                var data = {"user_question": user_question, 
                            "Question": temp_res["best_p"], 
                            "Answer": temp_res["best_a"], 
                            "sim_score": temp_res["agm"]};
                switch (convState.current.answer.value) {
                    case 'eval:1':
                        data["user_score"] = 1;
                        break;
                    case 'eval:2':
                        data["user_score"] = 2;
                        break;
                    default:
                        data["user_score"] = 3;
                }
                $.ajax({
                    url: server_addr + "/eval",
                    type: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    data: JSON.stringify(data),
                    crossDomain: true,
                    success: function(res){
                                if (res['status'] == '0') return alert_fail();
                                convState.current.next = convState.newState({
                                    type: 'input',
                                    questions: ["Sucessfully recorded. What's next?"]
                                });
                                ready();
                    },
                    error: function(res){
                        return alert_fail();
                    }
                });
            } 
            else if (convState.current.answer.value==='nt') {
                convState.current.next = convState.newState({
                    type: 'input',
                    questions: ['OK! Feel free to ask me more questions.']
                });
                ready();
            }
            else if (convState.current.answer.value==='hn') {
                ret_sim_ques("I'm sorry, but I also found some similar questions to help you:", temp_res);
            }
            else if(convState.current.answer.value==='fh') {
                $.ajax({
                    url: findUserUrl,
                    type: 'POST',
                    data: JSON.stringify({'find': 1}), 
                    contentType: 'application/json; charset=utf-8',
                    success: function(data) {
                        if (data.TA_available == true) {
                            mode = 1;
                            TA_room = data.TA[0].split('@')[0] + "@conference.localhost";
                            // join room
                            join_room(jid, TA_room);
                            convState.current.next = convState.newState({
                                type: 'input',
                                questions: ['Found a matched TA for you. Enter \"END\" to end the session.']
                            });
                            ready();
                            convForm.dialogue=0;
                        }
                        else {
                            mode = 2;
                            jid_name = jid.split('@')[0];
                            room_name = "room" + jid_name + "@conference.localhost";
                            reason = user_question;
                            $.xmpp.sendInvitation(public_room, room_name, reason);
                            join_room(jid, room_name);
                            convState.current.next = convState.newState({
                                type: 'input',
                                questions: ["Invitation has been sent, you can wait for other's response. Enter \"END\" to stop waiting."]
                            });
                            ready();
                            convForm.dialogue=0;
                        }
                    }
                });
            }
            else {
                user_question = convState.current.answer.value;
                if (mode == 0) {
                    $.ajax({
                        url: server_addr + "/predict",
                        type: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        data: JSON.stringify({"data":convState.current.answer.value}),
                        crossDomain: true,
                        success: function(res){
                                temp_res = res;
                                if (res["agm"] < score_threshold) {
                                    Q = "I'm not sure about the answer, but I found some similar questions to help you:";
                                    ret_sim_ques(Q, res);
                                }
                                else {
                                    convState.current.next = convState.newState({
                                        type: 'input',
                                        noAnswer: true,
                                        questions: [res["best_p"][0]]
                                    });
                                    convState.current.next.next = convState.newState({
                                        type: 'input',
                                        noAnswer: true,
                                        questions: [res["best_a"][0]]
                                    });
                                    convState.current.next.next.next = convState.newState({
                                        type: 'select',
                                        questions: ['Does that help you?'],
                                        answers: [ {text:'Yes', value:'nt'},
                                                    {text:'No', value:'hn' }]
                                    });
                                    ready();
                                }
                        },
                        error: function(res){
                                    return alert_fail();
                        }
                    });
                }
                else { 
                    // TA mode or public mode
                    if (user_question == "END") {
                        mode = 0;
                        convForm.dialogue = 1;
                        join_room(jid, public_room, function(){
                            append_message("The chatting session is ended.");
                        });
                    }
                    else {
                        $.xmpp.sendGroupMessage(current_room, user_question, function(res){
                        });
                    }
                }
            }
        }}});
        $.xmpp.connect({url: xmpp_server_addr, jid: jid, password: jid.split('@')[0], 
            onConnect: function(){
                $.xmpp.setPresence(null);
                join_room(jid, public_room);
            },
            onMessage: function(message){
                if (message.from.split('/')[1] != jid.split('@')[0]){
                    text_message = "<b>" + message.from.split('/')[1] + "</b>: " + message.body;
                    append_message(text_message)
                }
            },
            onInvitation: function(invitation){
                from_jid = invitation.from.split('/')[1]
                if (from_jid != jid.split('@')[0]){
                    $("#inv_reason").html("User <b>" + from_jid + "</b> is asking for help: <br/>" + invitation.reason);
                    $("#accept_inv").click(function(){
                        join_room(jid, invitation.to, function(){
                            append_message("Started the chat with <b>" + invitation.from.split('/')[1] + "</b>.");
                            append_message("<b>" + from_jid + "</b>: " + invitation.reason);
                        });
                        convForm.dialogue=0;
                        document.getElementById('joinDiscussionModal').style.display = "none";
                        mode = 2;
                    });
                    var modal = document.getElementById('joinDiscussionModal');
                    modal.style.display = "block";
                }
            },
            onPresence: function(data){
                if (mode == 2 && data.show == "unavailable" && data.from.split('/')[0] == current_room) {
                    var msg = "<b>" + data.from.split('/')[1] + "</b> left the chat.";
                    console.log(msg);
                    $.ajax({
                        url: checkRoomUserUrl,
                        type: 'POST',
                        data: JSON.stringify({'room': current_room}), 
                        contentType: 'application/json; charset=utf-8',
                        success: function(data) {
                            msg += "<br/>" + data.user_num + " other users in this room.";
                            append_message(msg);
                        }
                    });
                }
            }
        });
		// Get the modal
        var modal = document.getElementById('joinDiscussionModal');
        var span = document.getElementsByClassName("close")[0];
        span.onclick = function() {
            modal.style.display = "none";
        }
        $("#decline_inv").click(function(){
            modal.style.display = "none";
        });
        window.onclick = function(event) {
            if (event.target == modal) {
                modal.style.display = "none";
            }
        }
    });
    $(document).ready(function(){
    });
}
