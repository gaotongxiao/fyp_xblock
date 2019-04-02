var server_addr = "http://1cbf2ac9.ngrok.io";
jQuery(function($){
    var count = 0;
    var temp_res = null;
    var user_question = null;
    var convForm = $('#chat').convform({eventList:{onInputSubmit: function(convState, ready) {
        function alert_fail() {
            convState.current.next = convState.newState({
                type: 'input',
                //name: 'dynamic-question-'+count,
                questions: ['Congratulations! Server is crashed.', 'The robot has left the chat.', 'Bye.']
            });
            ready();
        }
        console.log('submitting input...');
        //here you send the response to your API, get the results and build the next question
        //when ready, call 'ready' callback (passed as the second parameter)
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

            
        } else {
            user_question = convState.current.answer.value;
            $.ajax({
                url: server_addr + "/predict",
                type: 'POST',
                headers: {'Content-Type': 'application/json'},
                data: JSON.stringify({"data":convState.current.answer.value}),
                crossDomain: true,
                success: function(res){
                        temp_res = res;
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
                },
                error: function(res){
                            return alert_fail();
                }
            });
        }
    }}});
});
