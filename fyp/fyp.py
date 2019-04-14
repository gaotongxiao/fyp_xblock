"""TO-DO: Write a description of what this XBlock is."""

import pkg_resources

from xblock.core import XBlock
from xblock.fields import Integer, Scope
from xblock.fragment import Fragment
from realtime_help import provider


@XBlock.wants('user')
class FYPXBlock(XBlock):
    """
    TO-DO: document what your XBlock does.
    """

    # Fields are defined on the class.  You can access them in your code as
    # self.<fieldname>.

    # TO-DO: delete count, and define your own fields.
    count = Integer(
        default=0, scope=Scope.user_state,
        help="A simple counter, to show something happening",
    )
    '''
    user_id = Integer(
        default=0, scope=Scope.user_state,
        help="A simple counter, to show something happening",
    )
    '''
    '''
    room_id_to_owner_display_name = Dict(
        help='Mapping from room ID to its owner\'s display name',
        scope=Scope.user_state_summary, default={})
    '''
    ejab = provider.Factory.get_default_provider()
    _TA_ids = ['ta1@fyp', 'ta2@fyp']

    def reg_account(self, jid):
        self.ejab.register_user(jid, jid)

    def resource_string(self, path):
        """Handy helper for getting resources from our kit."""
        data = pkg_resources.resource_string(__name__, path)
        return data.decode("utf8")

    # TO-DO: change this view to display your data your own way.
    def student_view(self, context=None):
        """
        The primary view of the FYPXBlock, shown to students
        when viewing courses.
        """
        #jid = str(self.scope_ids.user_id)
        jid = str(self.runtime.service(self, 'user').get_current_user().opt_attrs['edx-platform.username'] );
        self.reg_account(jid)
        html = self.resource_string("static/html/fyp_new.html")
        frag = Fragment(html.format(self=self))
        #frag.add_css(self.resource_string("static/css/fyp.css"))
        frag.add_css(self.resource_string("static/css/demo.css"))
        frag.add_css(self.resource_string("static/css/jquery.convform.css"))
        frag.add_css_url("https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css")
        #frag.add_javascript(self.resource_string("static/js/src/fyp.js"))
        frag.add_javascript("var jid = '%s@fyp';" % (jid))
        frag.add_javascript(self.resource_string("static/js/src/jquery.xmpp.js"))
        frag.add_javascript(self.resource_string("static/js/src/autosize.min.js"))
        frag.add_javascript(self.resource_string("static/js/src/jquery.convform.js"))
        frag.add_javascript(self.resource_string("static/js/src/fyp_new.js"))
        frag.add_javascript_url("https://cdn.staticfile.org/twitter-bootstrap/3.3.7/js/bootstrap.min.js")
        #frag.add_javascript_url("https://code.jquery.com/jquery-3.4.0.min.js")
        frag.initialize_js('Chat');
        return frag

    # TO-DO: change this handler to perform your own actions.  You may need more
    # than one handler, or you may not need any handlers at all.
    @XBlock.json_handler
    def increment_count(self, data, suffix=''):
        """
        An example handler, which increments the data.
        """
        # Just to show data coming in...
        assert data['hello'] == 'world'

        self.count += 1
        return {"count": self.count}
    
    @XBlock.json_handler
    def find_users(self, data, suffix=''):
        jid = str(self.runtime.service(self, 'user').get_current_user().opt_attrs['edx-platform.username'] );
        assert data['find'] == 1
        res = {'TA_available': False, 'TA': [], 'STU': []}
        online_jids = self.ejab.get_helper_jids(jid)
        for user_prime in online_jids:
            user = user_prime.split('/')[0]
            if user in self._TA_ids:
                res['TA_available'] = True
                res['TA'].append(user)
            else:
                res['STU'].append(user)
        return res

    @XBlock.json_handler
    def check_room_users(self, data, suffix=''):
        online_users = self.ejab.get_room_occupants(data['room'].split('@')[0])
        res = {}
        res['user_num'] = len(online_users) - 1
        return res

    # TO-DO: change this to create the scenarios you'd like to see in the
    # workbench while developing your XBlock.
    @staticmethod
    def workbench_scenarios():
        """A canned scenario for display in the workbench."""
        return [
            ("FYPXBlock",
             """<fyp/>
             """),
            ("Multiple FYPXBlock",
             """<vertical_demo>
                <fyp/>
                <fyp/>
                <fyp/>
                </vertical_demo>
             """),
        ]
