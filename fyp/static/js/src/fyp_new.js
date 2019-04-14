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
        var score_threshold = 0.3;
        var convForm = $('#chat').convform({eventList:{onInputSubmit: function(convState, ready) {
            function alert_fail() {
                convState.current.next = convState.newState({
                    type: 'input',
                    questions: ['Congratulations! Server is crashed.', 'The robot has left the chat.', 'Bye.']
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
                                                    questions: ['Now you can talk to TA.']
                                                });
                                                ready();
                                            }
                                            else {
                                                mode = 2;
                                                jid_name = jid.split('@')[0];
                                                room_name = "room" + jid_name + "@conference.localhost";
                                                reason = jid_name + " asked: " + user_question + ", are you willing to help?";
                                                $.xmpp.sendInvitation(public_room, room_name, reason);
                                                join_room(jid, room_name);
                                                convState.current.next = convState.newState({
                                                    type: 'input',
                                                    questions: ["发动群众的力量！"]
                                                });
                                                ready();
                                                convForm.dialogue=0;
                                            }
                                        }
                                    });
                                }
                                else {
                                    convState.current.next = convState.newState({
                                        type: 'input',
                                        noAnswer: true,
                                        questions: [res["best_p"]]
                                    });
                                    convState.current.next.next = convState.newState({
                                        type: 'input',
                                        questions: [res["best_a"]]
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
                    $.xmpp.sendGroupMessage(current_room, user_question, function(res){
                    });
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
                    text_message = message.from.split('/')[1] + ": " + message.body;
                    append_message(text_message)
                }
            },
            onInvitation: function(invitation){
                if (invitation.from.split('/')[1] != jid.split('@')[0]){
                    $("#inv_reason").html(invitation.reason);
                    $("#accept_inv").click(function(){
                        join_room(jid, invitation.to, function(){
                            append_message("Started the chat with " + invitation.from.split('/')[1] + ".");
                        });
                        convForm.dialogue=0;
                        document.getElementById('joinDiscussionModal').style.display = "none";
                        mode = 2;
                    });
                    var modal = document.getElementById('joinDiscussionModal');
                    modal.style.display = "block";
                }
            }
        });
        /*
        function close_box(){
			var box = document.getElementById("popup-box")
			if(box.style.display ==="none"){
				box.style.display = "block";
			}
			else{
				box.style.display = "none";
			}
        }
        */
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
